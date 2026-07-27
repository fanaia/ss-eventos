"use strict";
const {defineRoutes,registry,GenericError}=require("@oondemand/oon-core-back");
const {calcularSaldoFinanceiro,validarValorPagamento}=require("../services/pagamentosItem");
const {recalcularIndicadoresItem}=require("../services/omieIntegration");
function model(nome){const M=registry.getModel(nome)?.mongooseModel;if(!M)throw new GenericError(`Model ${nome} não registrada.`);return M;}
async function obterItem(id){const item=await model("ProjetoItem").findById(id).lean();if(!item)throw new GenericError("Item do projeto não encontrado.",{statusCode:404});return item;}
async function formaPadrao(){return model("FormaPagamento").findOne({padrao:true,status:"Ativo"}).lean();}
async function calcularSaldo(item){const pagamentos=await model("Pagamento").find({projetoItemId:item._id,canceladoNaCentral:{$ne:true}},{valor:1}).lean();return calcularSaldoFinanceiro(item.contratacaoTotal,pagamentos);}
defineRoutes("/projetos-itens",router=>{
 router.private.get("/:id/pagamento-pendente",async(req,res)=>{const item=await obterItem(req.params.id),[saldo,forma]=await Promise.all([calcularSaldo(item),formaPadrao()]);res.json({dataPrevisaoPagamento:new Date().toISOString().slice(0,10),formaPagamentoId:forma?._id??"",valor:saldo.valorPendente,nfRecebida:false,...saldo});});
 router.private.post("/:id/gerar-pagamento",{roles:["desenvolvedor"],audit:{entidade:"Pagamento",acao:"gerar_pagamento_item"}},async(req,res)=>{const item=await obterItem(req.params.id),saldo=await calcularSaldo(item),valor=validarValorPagamento(req.body?.valor,saldo),dados={projetoId:item.projetoId,projetoItemId:item._id,dataPrevisaoPagamento:req.body?.dataPrevisaoPagamento,formaPagamentoId:req.body?.formaPagamentoId,valor,responsavelPagamentoId:req.body?.responsavelPagamentoId,nfRecebida:Boolean(req.body?.nfRecebida),etapa:"Solicitado",statusTrabalho:"Aguardando início"},validate=registry.getValidation("Pagamento");if(validate)await validate(dados,{op:"create",method:"post",current:null,changes:dados,consolidated:dados});const pagamento=await model("Pagamento").create(dados),indicadores=await recalcularIndicadoresItem(item._id);res.status(201).json({pagamento,indicadores});});
});
