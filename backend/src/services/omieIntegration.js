"use strict";

const os = require("node:os");
const { registry, GenericError } = require("@oondemand/oon-core-back");
const { criarOmieClient, OmieApiError } = require("./omieClient");
const { mapearClienteParaOmie, mapearClienteDoOmie, mapearCategoriaOmie, mapearFormaPagamentoOmie, mapearContaPagar, extrairEstadoContaPagar } = require("./omieMappers");
const { somenteDigitos, hashPayload, sanitizarErro, codigoClienteIntegracao, codigoPagamentoIntegracao, arredondarMoeda, dataIsoDeOmie, primeiraChave } = require("./omieUtils");
const { obterOuCriarConfiguracaoAtiva } = require("../models/OmieConfiguracao");
const { assegurarFormaPadrao } = require("../models/FormaPagamento");
const { atrasoTentativa, enfileirarIntegracao } = require("../models/IntegrationOutbox");

function model(nome) { const Model = registry.getModel(nome)?.mongooseModel; if (!Model) throw new GenericError(`Model ${nome} não registrada.`); return Model; }
function exigirIntegracaoAtiva() { if (process.env.OMIE_ENABLED !== "true") throw new GenericError("A integração Omie está desativada. Configure OMIE_ENABLED=true.", { statusCode: 503 }); }
async function contexto(opcoes={}) { exigirIntegracaoAtiva(); return { client: opcoes.client || criarOmieClient(), config: await obterOuCriarConfiguracaoAtiva() }; }

async function sincronizarCliente(id, opcoes={}) {
  const { client } = await contexto(opcoes), Cliente=model("ClienteFornecedor"), cliente=await Cliente.findById(id).lean();
  if(!cliente) throw new GenericError("Cliente/Fornecedor não encontrado.",{statusCode:404});
  const contato=await model("Contato").findOne({clienteFornecedorId:cliente._id,status:"Ativo"}).sort({createdAt:1}).lean();
  const payload=mapearClienteParaOmie(cliente,contato), resposta=await client.chamar("clientes","UpsertCliente",[payload]);
  const codigo=Number(resposta.codigo_cliente_omie||resposta.codigo_cliente||cliente.codigoClienteOmie||0)||undefined;
  await Cliente.updateOne({_id:cliente._id},{$set:{codigoClienteOmie:codigo,codigoClienteIntegracao:payload.codigo_cliente_integracao,omieSincronizadoEm:new Date(),omieStatusIntegracao:"Sincronizado",omieUltimoErro:"",omiePayloadHash:hashPayload(payload),omieVersaoLocalSincronizada:Number(cliente.omieVersaoLocal||1)}});
  return { codigoClienteOmie:codigo, codigoClienteIntegracao:payload.codigo_cliente_integracao };
}

async function salvarClienteImportado(registro) {
  const Cliente=model("ClienteFornecedor"), dados=mapearClienteDoOmie(registro), doc=somenteDigitos(dados.documento);
  const filtros=[dados.codigoClienteOmie?{codigoClienteOmie:dados.codigoClienteOmie}:null,dados.codigoClienteIntegracao?{codigoClienteIntegracao:dados.codigoClienteIntegracao}:null,dados.documento?{documento:dados.documento}:null,doc&&doc!==dados.documento?{documento:doc}:null].filter(Boolean);
  const atual=filtros.length?await Cliente.findOne({$or:filtros}).lean():null, agora=new Date();
  if(!atual){const novo=new Cliente({...dados,omieSincronizadoEm:agora,omieStatusIntegracao:"Sincronizado",omieVersaoLocal:1,omieVersaoLocalSincronizada:1,omiePayloadHash:hashPayload(registro)});if(!novo.codigoClienteIntegracao)novo.codigoClienteIntegracao=codigoClienteIntegracao(novo._id);await novo.save();return novo;}
  const conflito=Number(atual.omieVersaoLocal||1)>Number(atual.omieVersaoLocalSincronizada||0)&&atual.omieStatusIntegracao==="Pendente";
  return Cliente.findOneAndUpdate({_id:atual._id},{$set:conflito?{codigoClienteOmie:dados.codigoClienteOmie,omieAtualizadoEm:agora,omieStatusIntegracao:"Conflito",omieUltimoErro:"Cadastro alterado na Central e no Omie; revisão manual necessária."}:{...dados,omieSincronizadoEm:agora,omieStatusIntegracao:"Sincronizado",omieUltimoErro:"",omiePayloadHash:hashPayload(registro),omieVersaoLocalSincronizada:Number(atual.omieVersaoLocal||1)}},{new:true});
}

async function importarClientes(opcoes={}) {
  const {client,config}=await contexto(opcoes), registros=await client.paginar("clientes","ListarClientes",{apenas_importado_api:"N"},r=>r.clientes_cadastro||r.clientes_cadastro_resumido||[]);
  for(const r of registros) await salvarClienteImportado(r);
  await model("OmieConfiguracao").updateOne({_id:config._id},{$set:{ultimaSincronizacaoCadastrosEm:new Date()}});
  return {processados:registros.length};
}
async function importarCategorias(opcoes={}) {
  const {client,config}=await contexto(opcoes), Model=model("OmieCategoria"), agora=new Date(), registros=await client.paginar("categorias","ListarCategorias",{},r=>r.categoria_cadastro||r.categorias||[]);
  for(const r of registros){const d=mapearCategoriaOmie(r,agora);await Model.findOneAndUpdate({codigo:d.codigo},{$set:{...d,payloadHash:hashPayload(r),status:d.contaInativa?"Inativo":"Ativo"}},{upsert:true,new:true,setDefaultsOnInsert:true});}
  await Model.updateMany({vistoEm:{$lt:agora},status:"Ativo"},{$set:{status:"Inativo",contaInativa:true}});await model("OmieConfiguracao").updateOne({_id:config._id},{$set:{ultimaSincronizacaoCadastrosEm:agora}});return {processados:registros.length};
}
async function importarFormasPagamento(opcoes={}) {
  const {client,config}=await contexto(opcoes), Forma=model("FormaPagamento"), agora=new Date(), registros=await client.paginar("formasPagamentoCompras","ListarFormasPagCompras",{},r=>r.cadastros||[]);
  for(const r of registros){const d=mapearFormaPagamentoOmie(r,agora);await Forma.findOneAndUpdate({codigoOmie:d.codigoOmie},{$set:d,$setOnInsert:{padrao:false}},{upsert:true,new:true,setDefaultsOnInsert:true});}
  await Forma.updateMany({origem:"Omie",vistoEm:{$lt:agora},status:"Ativo"},{$set:{status:"Inativo",padrao:false}});await assegurarFormaPadrao();await model("OmieConfiguracao").updateOne({_id:config._id},{$set:{ultimaSincronizacaoCadastrosEm:agora}});return {processados:registros.length};
}

async function resolverCategoria(item) {
  const Categoria=model("Categoria"), OmieCategoria=model("OmieCategoria"), ids=[item.subcategoriaId,item.categoriaId].filter(Boolean), cats=await Categoria.find({_id:{$in:ids}}).lean(), porId=new Map(cats.map(c=>[String(c._id),c]));
  const escolhida=[porId.get(String(item.subcategoriaId||"")),porId.get(String(item.categoriaId||""))].find(c=>c?.omieCategoriaId);
  if(!escolhida) throw new GenericError("Relacione a categoria/subcategoria do item com uma categoria financeira do Omie.",{statusCode:409});
  const omie=await OmieCategoria.findById(escolhida.omieCategoriaId).lean();if(!omie||omie.status!=="Ativo"||omie.contaInativa||omie.totalizadora||omie.transferencia||omie.naoExibir)throw new GenericError("A categoria financeira do Omie está inativa ou não pode receber lançamentos.",{statusCode:409});return omie;
}
async function fornecedorDoPagamento(pagamento,opcoes) {
  const item=await model("ProjetoItem").findById(pagamento.projetoItemId).lean(), projeto=item?await model("Projeto").findById(item.projetoId).lean():null;
  if(!item||!projeto) throw new GenericError("Item ou projeto do pagamento não encontrado.",{statusCode:409});let fornecedor=await model("ClienteFornecedor").findById(projeto.fornecedorId).lean();if(!fornecedor?.fornecedor)throw new GenericError("Fornecedor do projeto inválido.",{statusCode:409});if(!fornecedor.codigoClienteOmie||fornecedor.omieStatusIntegracao!=="Sincronizado"){await sincronizarCliente(fornecedor._id,opcoes);fornecedor=await model("ClienteFornecedor").findById(fornecedor._id).lean();}return {item,fornecedor};
}
async function aplicarEstadoPagamento(pagamento,titulo) {
  const estado=extrairEstadoContaPagar(titulo), Pagamento=model("Pagamento");
  await Pagamento.findByIdAndUpdate(pagamento._id,{$set:{codigoLancamentoOmie:estado.codigoLancamentoOmie||pagamento.codigoLancamentoOmie,omieValorTitulo:estado.valorDocumento||pagamento.valor,omieValorPago:estado.valorPago,omieValorPendente:estado.valorPendente,omieLiquidado:estado.liquidado,omieDataUltimaBaixa:dataIsoDeOmie(estado.dataUltimaBaixa)||pagamento.omieDataUltimaBaixa,omieStatusIntegracao:"Enviado",omieUltimoErro:"",omieUltimaSincronizacaoEm:new Date(),etapa:estado.liquidado?"Pagamento Ok":"Enviado para Omie"}},{skipOmieOutbox:true});
  await recalcularIndicadoresItem(pagamento.projetoItemId);return estado;
}
async function enviarContaPagar(id,opcoes={}) {
  const {client,config}=await contexto(opcoes), Pagamento=model("Pagamento"), pagamento=await Pagamento.findById(id).lean();if(!pagamento)throw new GenericError("Pagamento não encontrado.",{statusCode:404});
  if(process.env.OMIE_EXIGIR_NF==="true"&&!pagamento.nfRecebida)throw new GenericError("A NF deve estar recebida antes do envio ao Omie.",{statusCode:409});if(!["Aprovado","Enviado para Omie","Pagamento Ok"].includes(pagamento.etapa))throw new GenericError("Aprove o pagamento antes de enviá-lo ao Omie.",{statusCode:409});
  const {item,fornecedor}=await fornecedorDoPagamento(pagamento,opcoes), categoria=await resolverCategoria(item), payload=mapearContaPagar({pagamento:{...pagamento,codigoLancamentoIntegracao:pagamento.codigoLancamentoIntegracao||codigoPagamentoIntegracao(pagamento._id)},codigoFornecedorOmie:fornecedor.codigoClienteOmie,codigoCategoriaOmie:categoria.codigo,contaCorrenteId:config.contaCorrenteId});
  await Pagamento.updateOne({_id:id},{$set:{codigoLancamentoIntegracao:payload.codigo_lancamento_integracao,omieStatusIntegracao:"Processando",omieUltimoErro:""}});
  try{const resposta=await client.chamar("contasPagar","UpsertContaPagar",[payload]);const titulo={...resposta,...payload};await Pagamento.updateOne({_id:id},{$set:{omieCodigoCategoriaEnviado:categoria.codigo,omieCodigoClienteFornecedorEnviado:fornecedor.codigoClienteOmie,omieNumeroDocumentoEnviado:payload.numero_documento,omiePayloadHash:hashPayload(payload)}});return aplicarEstadoPagamento(pagamento,titulo);}catch(erro){if(erro instanceof OmieApiError&&erro.retryable){try{return await consultarContaPagar(id,opcoes);}catch{}}await Pagamento.updateOne({_id:id},{$set:{omieStatusIntegracao:"Erro",omieUltimoErro:sanitizarErro(erro)}});throw erro;}
}
async function consultarContaPagar(id,opcoes={}) {
  const {client}=await contexto(opcoes), pagamento=await model("Pagamento").findById(id).lean();if(!pagamento?.codigoLancamentoIntegracao&&!pagamento?.codigoLancamentoOmie)throw new GenericError("Pagamento ainda não possui título no Omie.",{statusCode:409});
  const chave=pagamento.codigoLancamentoOmie?{codigo_lancamento_omie:pagamento.codigoLancamentoOmie}:{codigo_lancamento_integracao:pagamento.codigoLancamentoIntegracao},titulo=await client.chamar("contasPagar","ConsultarContaPagar",[chave]);return aplicarEstadoPagamento(pagamento,titulo);
}
async function recalcularIndicadoresItem(itemId) {
  const Item=model("ProjetoItem"), Pagamento=model("Pagamento"), item=await Item.findById(itemId).lean();if(!item)return null;const ps=await Pagamento.find({projetoItemId:itemId,canceladoNaCentral:{$ne:true}}).lean(),planejado=arredondarMoeda(ps.reduce((s,p)=>s+Number(p.valor||0),0)),pago=arredondarMoeda(ps.reduce((s,p)=>s+Number(p.omieValorPago||0),0)),pendente=arredondarMoeda(Math.max(0,Number(item.contratacaoTotal||0)-pago));let status="Pagamento pendente";if(!ps.length)status="Sem pagamento";else if(ps.some(p=>p.omieStatusIntegracao==="Erro"))status="Erro de integração";else if(planejado>Number(item.contratacaoTotal||0)+.01)status="Divergência";else if(Number(item.contratacaoTotal||0)>0&&pago>=Number(item.contratacaoTotal||0)-.01)status="Pago";else if(pago>0)status="Parcialmente pago";else if(ps.some(p=>["Enviado","Processando"].includes(p.omieStatusIntegracao)))status="Enviado ao Omie";await Item.findByIdAndUpdate(itemId,{$set:{pagamentoTotalPlanejado:planejado,pagamentoTotalPago:pago,pagamentoValorPendente:pendente,pagamentoStatus:status}});return{planejado,pago,pendente,status};
}
async function reconciliarFinanceiro(opcoes={}) {
  const {config}=await contexto(opcoes), limite=Math.min(500,Number(opcoes.limite||100)), ps=await model("Pagamento").find({codigoLancamentoIntegracao:{$exists:true,$ne:""},omieStatusIntegracao:{$in:["Enviado","Processando","Erro"]},canceladoNaCentral:{$ne:true}}).sort({omieUltimaSincronizacaoEm:1}).limit(limite).lean(),erros=[];let processados=0;
  for(const p of ps){try{await consultarContaPagar(p._id,opcoes);processados+=1;}catch(e){erros.push({pagamentoId:String(p._id),erro:sanitizarErro(e)});await model("Pagamento").updateOne({_id:p._id},{$set:{omieStatusIntegracao:"Erro",omieUltimoErro:sanitizarErro(e)}});}}
  await model("OmieConfiguracao").updateOne({_id:config._id},{$set:{ultimaReconciliacaoFinanceiraEm:new Date()}});return{encontrados:ps.length,processados,erros};
}
function recursivo(obj,chaves,n=0){if(!obj||typeof obj!=="object"||n>5)return undefined;for(const c of chaves)if(obj[c]!==undefined)return obj[c];for(const v of Object.values(obj)){const r=recursivo(v,chaves,n+1);if(r!==undefined)return r;}return undefined;}
async function processarWebhooksPendentes(opcoes={}) {
 const Inbox=model("WebhookInbox"),Pagamento=model("Pagamento"),itens=await Inbox.find({status:{$in:["Pendente","Erro"]}}).sort({receivedAt:1}).limit(Math.min(100,Number(opcoes.limite||20))).lean();let processados=0;
 for(const i of itens){await Inbox.updateOne({_id:i._id},{$set:{status:"Processando"},$inc:{attempts:1}});try{const ci=recursivo(i.payload,["codigo_lancamento_integracao"]),co=recursivo(i.payload,["codigo_lancamento_omie","codigo_lancamento"]),p=await Pagamento.findOne(ci?{codigoLancamentoIntegracao:ci}:{codigoLancamentoOmie:Number(co||0)}).lean();if(p)await consultarContaPagar(p._id,opcoes);await Inbox.updateOne({_id:i._id},{$set:{status:"Concluído",processedAt:new Date(),lastError:""}});processados+=1;}catch(e){await Inbox.updateOne({_id:i._id},{$set:{status:"Erro",lastError:sanitizarErro(e)}});}}
 return{encontrados:itens.length,processados};
}
async function executar(e,opcoes){switch(e.tipo){case"OMIE_CLIENTE_UPSERT":return sincronizarCliente(e.aggregateId||e.payload?.clienteFornecedorId,opcoes);case"OMIE_CLIENTES_IMPORTAR":return importarClientes(opcoes);case"OMIE_FORMAS_IMPORTAR":return importarFormasPagamento(opcoes);case"OMIE_CATEGORIAS_IMPORTAR":return importarCategorias(opcoes);case"OMIE_CONTA_PAGAR_UPSERT":return enviarContaPagar(e.aggregateId||e.payload?.pagamentoId,opcoes);case"OMIE_FINANCEIRO_RECONCILIAR":return reconciliarFinanceiro(opcoes);case"OMIE_WEBHOOK_PROCESSAR":return processarWebhooksPendentes(opcoes);default:throw new GenericError(`Tipo de integração não suportado: ${e.tipo}`);}}
async function processarFila(opcoes={}) {
 exigirIntegracaoAtiva();const Outbox=model("IntegrationOutbox"),worker=`${os.hostname()}:${process.pid}`,limite=Math.min(100,Number(opcoes.limite||20)),erros=[];let processados=0;
 for(let n=0;n<limite;n+=1){const agora=new Date(),e=await Outbox.findOneAndUpdate({status:{$in:["Pendente","Erro temporário"]},$and:[{$or:[{proximaTentativaEm:{$lte:agora}},{proximaTentativaEm:null},{proximaTentativaEm:{$exists:false}}]},{$or:[{lockedAt:{$lt:new Date(Date.now()-600000)}},{lockedAt:null},{lockedAt:{$exists:false}}]}]},{$set:{status:"Processando",lockedAt:agora,lockedBy:worker},$inc:{tentativas:1}},{sort:{createdAt:1},new:true}).lean();if(!e)break;try{const r=await executar(e,opcoes);await Outbox.updateOne({_id:e._id},{$set:{status:"Concluído",concluidoEm:new Date(),responseSummary:r||{},ultimoErro:"",lockedAt:null,lockedBy:""}});processados+=1;}catch(err){const tentativas=Number(e.tentativas||1),definitivo=tentativas>=5||(err instanceof OmieApiError&&!err.retryable),mensagem=sanitizarErro(err);await Outbox.updateOne({_id:e._id},{$set:{status:definitivo?"Erro definitivo":"Erro temporário",ultimoErro:mensagem,proximaTentativaEm:definitivo?null:new Date(Date.now()+atrasoTentativa(tentativas)),lockedAt:null,lockedBy:""}});erros.push({id:String(e._id),erro:mensagem});}}
 return{processados,erros};
}
async function enfileirarSincronizacaoCompleta(){const janela=new Date().toISOString().slice(0,10);await Promise.all([["OMIE_CLIENTES_IMPORTAR","clientes"],["OMIE_CATEGORIAS_IMPORTAR","categorias"],["OMIE_FORMAS_IMPORTAR","formas"]].map(([tipo,nome])=>enfileirarIntegracao({tipo,aggregateType:"Omie",idempotencyKey:`omie:sync:${nome}:${janela}`,payload:{janela}})));return{enfileirados:3};}
module.exports={sincronizarCliente,importarClientes,importarCategorias,importarFormasPagamento,enviarContaPagar,consultarContaPagar,recalcularIndicadoresItem,reconciliarFinanceiro,processarWebhooksPendentes,processarFila,enfileirarSincronizacaoCompleta};
