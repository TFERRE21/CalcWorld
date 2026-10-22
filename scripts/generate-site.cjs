const fs=require("fs");
const path=require("path");
const vm=require("vm");
const root=process.cwd();
const source=fs.readFileSync(path.join(root,"calculators.js"),"utf8");
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const calculators=sandbox.window.CALCULATORS||[];
if(!calculators.length) throw new Error("No calculators found");
const site="https://calcworld.com.br";
const buildDate=new Date().toISOString().slice(0,10);
const categoryNames={math:{pt:"Matemática",en:"Math"},finance:{pt:"Finanças",en:"Finance"},work:{pt:"Trabalho",en:"Work"},business:{pt:"Negócios",en:"Business"},daily:{pt:"Dia a dia",en:"Everyday"},date:{pt:"Datas",en:"Dates"},health:{pt:"Saúde",en:"Health"},investment:{pt:"Investimentos",en:"Investments"}};
const localeData={
pt:{folder:"calculadoras",categoryFolder:"categoria",lang:"pt-BR",back:"Voltar",home:"Início",how:"Como usar",howText:"Informe os valores solicitados e clique em calcular. O resultado aparece no navegador.",important:"Importante",importantText:"Esta ferramenta é informativa. Em cálculos trabalhistas, fiscais, financeiros ou de saúde, confirme as regras aplicáveis.",related:"Você também pode gostar",ad:"Espaço para publicidade",categoryIntro:"Encontre calculadoras e ferramentas desta categoria.",sideTitle:"Memória de cálculo",sideText:"Depois de calcular, confira os dados informados, as parcelas consideradas, a fórmula e a interpretação do resultado.",sideResult:"Resultado transparente",sideItems:["Dados informados","Memória de cálculo","Fórmula / método","Observações e limitações","Imprimir ou salvar em PDF"],sideAttention:"Atenção",sideWarning:"Resultados trabalhistas, fiscais, financeiros e de saúde são estimativas informativas. Confira as regras aplicáveis ao seu caso."},
en:{folder:"calculators",categoryFolder:"category",lang:"en",back:"Back",home:"Home",how:"How to use",howText:"Enter the requested values and click calculate. The result appears in your browser.",important:"Important",importantText:"This tool is informational. Verify applicable rules for legal, financial, tax or health calculations.",related:"Related calculators",ad:"Advertising space",categoryIntro:"Find calculators and tools in this category.",sideTitle:"Calculation details",sideText:"After calculating, review the entered data, included amounts, formula and interpretation of the result.",sideResult:"Transparent result",sideItems:["Entered data","Calculation details","Formula / method","Notes and limitations","Print or save as PDF"],sideAttention:"Important",sideWarning:"Employment, tax, financial and health results are informational estimates. Check the rules that apply to your situation."},
};
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function prefix(l){return l==="pt"?"../../":"../../../"}
function calcUrl(l,slug){return l==="pt"?"/calculadoras/"+slug+"/":"/en/calculators/"+slug+"/"}
function catUrl(l,cat){const d=localeData[l];return l==="pt"?"/"+d.categoryFolder+"/"+cat+"/":"/"+l+"/"+d.categoryFolder+"/"+cat+"/"}
function formulaText(c,l){
 const map={
 percentage:{pt:"Resultado = valor × taxa ÷ 100",en:"Result = value × rate ÷ 100",es:"Resultado = valor × tasa ÷ 100"},
 rule3:{pt:"Regra de três: valor procurado = (B × C) ÷ A",en:"Rule of three: result = (B × C) ÷ A",es:"Regla de tres: resultado = (B × C) ÷ A"},
 average:{pt:"Média = soma dos valores ÷ quantidade de valores",en:"Average = sum of values ÷ number of values",es:"Promedio = suma de valores ÷ cantidad"},
 sum:{pt:"Soma = valor 1 + valor 2 + ...",en:"Sum = value 1 + value 2 + ...",es:"Suma = valor 1 + valor 2 + ..."},
 simpleInterest:{pt:"Montante = principal × (1 + taxa × períodos)",en:"Amount = principal × (1 + rate × periods)",es:"Monto = principal × (1 + tasa × períodos)"},
 compoundInterest:{pt:"Montante = principal × (1 + taxa) ^ períodos",en:"Amount = principal × (1 + rate) ^ periods",es:"Monto = principal × (1 + tasa) ^ períodos"},
 discount:{pt:"Preço final = preço × (1 − desconto ÷ 100)",en:"Final price = price × (1 − discount ÷ 100)",es:"Precio final = precio × (1 − descuento ÷ 100)"},
 increase:{pt:"Variação (%) = (novo − antigo) ÷ antigo × 100",en:"Change (%) = (new − old) ÷ old × 100",es:"Variación (%) = (nuevo − anterior) ÷ anterior × 100"},
 margin:{pt:"Margem = (vendas − custo) ÷ vendas × 100",en:"Margin = (sales − cost) ÷ sales × 100",es:"Margen = (ventas − costo) ÷ ventas × 100"},
 markup:{pt:"Preço de venda = custo × (1 + markup ÷ 100)",en:"Selling price = cost × (1 + markup ÷ 100)",es:"Precio de venta = costo × (1 + markup ÷ 100)"},
 commission:{pt:"Comissão = vendas × taxa ÷ 100",en:"Commission = sales × rate ÷ 100",es:"Comisión = ventas × tasa ÷ 100"},
 bmi:{pt:"IMC = peso ÷ altura²",en:"BMI = weight ÷ height²",es:"IMC = peso ÷ altura²"},
 speed:{pt:"Velocidade média = distância ÷ tempo",en:"Average speed = distance ÷ time",es:"Velocidad media = distancia ÷ tiempo"},
 pace:{pt:"Ritmo = tempo ÷ distância",en:"Pace = time ÷ distance",es:"Ritmo = tiempo ÷ distancia"},
 area:{pt:"Área = largura × comprimento",en:"Area = width × length",es:"Área = ancho × largo"},
 volume:{pt:"Volume = largura × comprimento × profundidade",en:"Volume = width × length × depth",es:"Volumen = ancho × largo × profundidad"},
 unitCost:{pt:"Custo unitário = custo total ÷ quantidade",en:"Unit cost = total cost ÷ quantity",es:"Costo unitario = costo total ÷ cantidad"},
 reorder:{pt:"Ponto de reposição = consumo diário × prazo + estoque de segurança",en:"Reorder point = daily usage × lead time + safety stock",es:"Punto de reposición = consumo diario × plazo + stock de seguridad"},investmentSimulator:{pt:"Valor futuro = capital inicial capitalizado + aportes mensais capitalizados",en:"Future value = compounded initial capital + compounded monthly contributions",es:"Valor futuro = capital inicial capitalizado + aportes mensuales capitalizados"},cdi:{pt:"Taxa usada = CDI × percentual do CDI",en:"Rate used = CDI × CDI percentage",es:"Tasa usada = CDI × porcentaje del CDI"},tesouro:{pt:"Projeção pela taxa anual informada e prazo do título",en:"Projection using the entered annual rate and term",es:"Proyección con la tasa anual y plazo indicados"},cdb:{pt:"Projeção pela taxa anual informada, com imposto estimado",en:"Projection using the entered annual rate, with estimated tax",es:"Proyección con tasa anual e impuesto estimado"},lciLca:{pt:"Projeção pela taxa anual informada e imposto informado",en:"Projection using the entered annual rate and entered tax",es:"Proyección con tasa anual e impuesto indicado"},fii:{pt:"Patrimônio estimado = cotas × preço futuro; rendimentos = cotas × dividendo",en:"Estimated value = shares × future price; distributions = shares × dividend",es:"Patrimonio estimado = cuotas × precio futuro; rendimientos = cuotas × dividendo"},poupanca:{pt:"Capitalização mensal pela taxa informada + aportes",en:"Monthly compounding at the entered rate + contributions",es:"Capitalización mensual con la tasa indicada + aportes"},dividendYield:{pt:"Dividend Yield = dividendos anuais ÷ preço × 100",en:"Dividend yield = annual dividends ÷ price × 100",es:"Dividend yield = dividendos anuales ÷ precio × 100"},stockInvestment:{pt:"Valor final pela variação do preço + dividendos informados",en:"Final value from price change + entered dividends",es:"Valor final por variación del precio + dividendos indicados"},cryptoInvestment:{pt:"Valor final pela variação de preço, descontando custos informados",en:"Final value from price change, less entered costs",es:"Valor final por variación del precio, menos costos"},realReturn:{pt:"Rendimento real = (1 + nominal) ÷ (1 + inflação) − 1",en:"Real return = (1 + nominal) ÷ (1 + inflation) − 1",es:"Rendimiento real = (1 + nominal) ÷ (1 + inflación) − 1"},investmentGoal:{pt:"Aporte necessário para atingir uma meta em determinado prazo",en:"Contribution needed to reach a target in a given term",es:"Aporte necesario para alcanzar una meta"},retirementInvestment:{pt:"Projeção de patrimônio pela capitalização mensal até a aposentadoria",en:"Projected wealth using monthly compounding until retirement",es:"Patrimonio proyectado con capitalización mensual hasta la jubilación"},compareInvestments:{pt:"Comparação por capitalização dos dois cenários e impostos informados",en:"Comparison by compounding both scenarios with entered taxes",es:"Comparación por capitalización de ambos escenarios e impuestos"},equivalentRate:{pt:"Conversão entre taxas equivalentes pela capitalização composta",en:"Equivalent-rate conversion using compound capitalization",es:"Conversión entre tasas equivalentes por capitalización compuesta"}
 };
 return map[c.type]?.[l]||"";
}

function workedExample(c,l){
 const pt=l==="pt";
 const examples={
  percentage:pt?["Exemplo resolvido","Se o valor é R$ 250 e a taxa é 12%, calcule 250 × 12 ÷ 100. O resultado é R$ 30. Para conferir, some R$ 30 ao valor original se estiver calculando um acréscimo."]:["Worked example","If the amount is 250 and the rate is 12%, calculate 250 × 12 ÷ 100. The result is 30. Add it to the original amount only when calculating an increase."],
  compoundInterest:pt?["Exemplo resolvido","Com R$ 1.000, taxa hipotética de 1% ao mês e prazo de 12 meses, sem novos aportes, a projeção é 1.000 × (1,01)^12 ≈ R$ 1.126,83 antes de impostos, tarifas e inflação. A taxa é apenas ilustrativa, não uma cotação atual."]:["Worked example","With 1,000, a hypothetical 1% monthly rate and 12 months, without new contributions, the projection is 1,000 × (1.01)^12 ≈ 1,126.83 before taxes, fees and inflation. The rate is illustrative, not a current quote."],
  simpleInterest:pt?["Exemplo resolvido","Um capital de R$ 1.000 a juros simples de 2% ao mês por 3 meses gera R$ 60 de juros (1.000 × 0,02 × 3) e montante de R$ 1.060."]:["Worked example","A principal of 1,000 at 2% simple interest per month for 3 months generates 60 in interest (1,000 × 0.02 × 3) and a total of 1,060."],
  discount:pt?["Exemplo resolvido","Um produto de R$ 200 com desconto de 15% tem economia de R$ 30 e preço final de R$ 170 (200 × (1 − 0,15))."]:["Worked example","A 200 item with a 15% discount saves 30 and costs 170 after the discount (200 × (1 − 0.15))."],
  increase:pt?["Exemplo resolvido","Um valor que passa de R$ 80 para R$ 92 aumentou R$ 12. A variação percentual é (92 − 80) ÷ 80 × 100 = 15%."]:["Worked example","A value increasing from 80 to 92 rose by 12. The percentage change is (92 − 80) ÷ 80 × 100 = 15%."],
  average:pt?["Exemplo resolvido","Para os valores 6, 8 e 10, some 6 + 8 + 10 = 24 e divida por 3. A média aritmética é 8."]:["Worked example","For 6, 8 and 10, add them to get 24 and divide by 3. The arithmetic mean is 8."],
  rule3:pt?["Exemplo resolvido","Se 3 unidades custam R$ 18, então 5 unidades custam (18 × 5) ÷ 3 = R$ 30, supondo preço unitário proporcional."]:["Worked example","If 3 units cost 18, then 5 units cost (18 × 5) ÷ 3 = 30, assuming a proportional unit price."],
  bmi:pt?["Exemplo resolvido","Para 70 kg e 1,75 m, o IMC é 70 ÷ (1,75 × 1,75) ≈ 22,9. O índice é uma referência geral e não avalia sozinho a saúde de uma pessoa."]:["Worked example","At 70 kg and 1.75 m, BMI is 70 ÷ (1.75 × 1.75) ≈ 22.9. It is a general indicator and does not assess a person's health on its own."],
  fuel:pt?["Exemplo resolvido","Uma viagem de 300 km em um veículo que faz 12 km/L exige cerca de 25 litros (300 ÷ 12). A R$ 5,80 por litro, o custo estimado é R$ 145."]:["Worked example","A 300 km trip in a vehicle averaging 12 km/L needs about 25 liters (300 ÷ 12). At 5.80 per liter, estimated fuel cost is 145."],
  margin:pt?["Exemplo resolvido","Se a venda é R$ 100 e o custo é R$ 65, o lucro bruto é R$ 35 e a margem sobre a venda é 35 ÷ 100 × 100 = 35%."]:["Worked example","If a sale is 100 and cost is 65, gross profit is 35 and margin on sales is 35 ÷ 100 × 100 = 35%."],
  unitCost:pt?["Exemplo resolvido","Se 40 unidades custam R$ 320 no total, o custo médio por unidade é 320 ÷ 40 = R$ 8. Não inclui custos indiretos que não tenham sido informados."]:["Worked example","If 40 units cost 320 in total, average unit cost is 320 ÷ 40 = 8. It excludes indirect costs not entered."],
  speed:pt?["Exemplo resolvido","Percorrer 150 km em 2,5 horas corresponde a 150 ÷ 2,5 = 60 km/h de velocidade média. Paradas devem ser incluídas no tempo se quiser calcular a média total da viagem."]:["Worked example","Traveling 150 km in 2.5 hours gives an average speed of 150 ÷ 2.5 = 60 km/h. Include stops in the time if you want the overall trip average."],
  volume:pt?["Exemplo resolvido","Uma caixa de 2 m × 1,5 m × 1 m tem volume de 3 m³ (2 × 1,5 × 1). Confirme se todas as medidas estão na mesma unidade."]:["Worked example","A box measuring 2 m × 1.5 m × 1 m has a volume of 3 m³. Make sure all dimensions use the same unit."],
  netSalary:pt?["Exemplo ilustrativo","Considere salário bruto de R$ 3.000 e descontos hipotéticos de R$ 350 e R$ 100. A conta simplificada é 3.000 − 350 − 100 = R$ 2.550 líquidos. Os descontos são apenas exemplos, não uma tabela oficial de INSS ou IRRF."]:["Illustrative example","With gross pay of 3,000 and hypothetical deductions of 350 and 100, the simplified calculation is 3,000 − 350 − 100 = 2,550 net. These deductions are examples, not official tax tables."],
  vacation:pt?["Exemplo ilustrativo","Para salário-base de R$ 3.000, o adicional constitucional de um terço equivale a R$ 1.000. O total bruto ilustrativo é R$ 4.000 antes de descontos e ajustes aplicáveis."]:["Illustrative example","For a base salary of 3,000, one third is 1,000. The illustrative gross total is 4,000 before applicable deductions and adjustments."],
  thirteenth:pt?["Exemplo ilustrativo","Com remuneração considerada de R$ 3.000 e 6 meses elegíveis no ano, a estimativa proporcional simplificada é 3.000 × 6 ÷ 12 = R$ 1.500 brutos, antes de descontos e validação dos requisitos legais."]:["Illustrative example","With remuneration of 3,000 and 6 eligible months in the year, a simplified proportional estimate is 3,000 × 6 ÷ 12 = 1,500 gross, before deductions and legal eligibility checks."],
  overtime:pt?["Exemplo ilustrativo","Se a hora normal custa R$ 13,64 e o adicional simulado é de 50%, a hora extra fica em cerca de R$ 20,46. Cinco horas seriam aproximadamente R$ 102,30 brutos. O divisor mensal e o adicional dependem da jornada e das regras aplicáveis."]:["Illustrative example","If a regular hour costs 13.64 and the simulated premium is 50%, the overtime hour is about 20.46. Five hours would be about 102.30 gross. The monthly divisor and premium depend on the schedule and applicable rules."],
  fgts:pt?["Exemplo ilustrativo","Usando apenas como exemplo uma base de R$ 3.000 e alíquota de 8%, o depósito estimado seria 3.000 × 0,08 = R$ 240. A alíquota pode variar conforme o tipo de vínculo; confira a regra aplicável."]:["Illustrative example","Using a 3,000 base and an 8% rate only as an example, the estimated deposit would be 3,000 × 0.08 = 240. The rate can vary by employment type; check the applicable rule."]
 };
 const item=examples[c.type]|| (pt?["Como interpretar o resultado","O resultado depende dos valores inseridos e do método indicado nesta página. Confira as unidades, o período e as hipóteses antes de usar o número em uma decisão."]:["How to interpret the result","The result depends on the values entered and the method shown on this page. Check units, time period and assumptions before using the number for a decision."]);
 return '<section class="info worked-example"><h2>'+item[0]+'</h2><p>'+item[1]+'</p></section>';
}

function searchIntent(c,l){
 if(l!=="pt") return "";
 const map={
 "salario-liquido":"Quem procura por salário líquido, calcular salário líquido, simulador de salário líquido ou calculadora de salário líquido encontra aqui uma ferramenta para estimar o valor recebido a partir do salário bruto e dos descontos informados.",
 "rescisao":"Quem pesquisa por simulador de rescisão, calcular rescisão, calculadora de rescisão trabalhista, cálculo de rescisão ou rescisão CLT pode usar esta página para estimar as verbas conforme o motivo do desligamento e os dados informados.",
 "financiamento":"Quem pesquisa por calculadora de financiamento, simulador de financiamento ou calcular financiamento pode usar esta ferramenta para estimar parcela, juros e custo total.",
 "juros-compostos":"Quem pesquisa por calculadora de juros compostos, simulador de juros compostos ou calcular juros compostos pode simular diferentes taxas, valores e períodos.",
 "ferias":"Quem pesquisa por calculadora de férias, calcular férias ou simulador de férias pode estimar o valor das férias com adicional de um terço.",
 "combustivel":"Quem pesquisa por calculadora de combustível, calcular combustível ou simulador de combustível pode estimar litros, consumo e custo de uma viagem.",
 "decimo-terceiro":"Quem pesquisa por calculadora de 13º salário, calcular décimo terceiro ou simulador de décimo terceiro pode estimar o valor proporcional.",
 "simulador-de-investimentos":"Quem pesquisa por simulador de investimentos, calculadora de investimentos, simular investimentos ou calcular rendimento de investimento pode projetar capital, aportes, taxa e valor futuro.",
 "calculadora-cdi":"Quem pesquisa por calculadora CDI, simulador CDI, rendimento CDI ou investimento que rende CDI pode simular uma taxa vinculada ao CDI informado.",
 "simulador-tesouro-direto":"Quem pesquisa por simulador Tesouro Direto, calculadora Tesouro Direto, Tesouro Selic, Tesouro IPCA+, Tesouro Prefixado ou rendimento do Tesouro pode estimar o valor futuro com a taxa informada.",
 "calculadora-cdb":"Quem pesquisa por calculadora CDB, simulador CDB, rendimento CDB ou quanto rende CDB pode estimar o valor líquido a partir da taxa e do imposto informados.",
 "calculadora-lci-lca":"Quem pesquisa por calculadora LCI, calculadora LCA, simulador LCI LCA ou rendimento LCI pode estimar o crescimento com taxa, prazo e aportes.",
 "simulador-fii":"Quem pesquisa por simulador de FII, calculadora de fundos imobiliários, rendimento de FII, dividendos de FII ou quanto rende FII pode estimar patrimônio e rendimentos a partir dos dados informados.",
 "calculadora-poupanca":"Quem pesquisa por calculadora de poupança, simulador de poupança ou quanto rende a poupança pode projetar a evolução do saldo com a taxa mensal informada.",
 "calculadora-dividend-yield":"Quem pesquisa por calculadora Dividend Yield, calcular dividend yield, DY de ação ou DY de FII pode calcular a relação entre dividendos e preço.",
 "simulador-de-acoes":"Quem pesquisa por simulador de ações, calculadora de ações, calcular lucro em ações ou rendimento de ações pode simular valorização e dividendos.",
 "simulador-de-criptomoedas":"Quem pesquisa por simulador de criptomoedas, calculadora de cripto, lucro com Bitcoin ou simular investimento em cripto pode projetar um cenário de preço de entrada e saída.",
 "calculadora-rendimento-real":"Quem pesquisa por calculadora de rendimento real, rentabilidade real, retorno real ou rendimento descontando inflação pode calcular o efeito da inflação sobre a rentabilidade.",
 "meta-de-investimento":"Quem pesquisa por calculadora de meta financeira, meta de investimento, quanto investir por mês ou aporte mensal para atingir uma meta pode estimar o aporte necessário.",
 "simulador-de-aposentadoria":"Quem pesquisa por simulador de aposentadoria, calculadora de aposentadoria, quanto investir para aposentadoria ou renda para aposentadoria pode projetar um patrimônio com aportes e taxa informada.",
 "comparador-de-investimentos":"Quem pesquisa por comparador de investimentos, comparar CDB, LCI, Tesouro ou investimentos pode colocar duas taxas e impostos em um mesmo cenário matemático.",
 "taxa-equivalente":"Quem pesquisa por taxa equivalente, converter taxa mensal para anual ou taxa anual para mensal pode calcular a equivalência por capitalização composta."
 };
 return map[c.slug]||"";
}
function seoText(c,l){
 const guidance={
  percentage:{pt:"Use a taxa como número percentual: 12 significa 12%, não 0,12%. Para calcular aumento ou desconto, confira se a ferramenta escolhida corresponde à operação desejada.",en:"Enter the rate as a percentage: 12 means 12%, not 0.12. For increases or discounts, make sure the selected tool matches the operation."},
  netSalary:{pt:"Separe salário bruto, descontos obrigatórios e descontos opcionais. O resultado é uma estimativa; a folha real depende da competência, das regras vigentes e dos dados individuais.",en:"Separate gross pay, mandatory deductions and optional deductions. This is an estimate; actual payroll depends on the pay period, current rules and individual details."},
  termination:{pt:"Antes de calcular, reúna salário, datas de admissão e saída, motivo do desligamento, aviso prévio, férias e informações de FGTS. A modalidade de rescisão altera as verbas devidas.",en:"Before calculating, gather salary, start and end dates, termination reason, notice, vacation and FGTS information. The termination type changes which amounts may be due."},
  loan:{pt:"Compare taxa, prazo, entrada, parcela e custo total. Uma parcela menor pode significar prazo maior e mais juros pagos no total.",en:"Compare rate, term, down payment, installment and total cost. A lower installment can mean a longer term and more interest paid overall."},
  compoundInterest:{pt:"Juros compostos são calculados sobre o saldo acumulado. Confira se a taxa e o período usam a mesma frequência, por exemplo, taxa mensal com meses.",en:"Compound interest is calculated on the accumulated balance. Make sure the rate and term use the same frequency, such as a monthly rate with months."},
  cdi:{pt:"A simulação depende da taxa CDI informada, do percentual contratado, do prazo, dos aportes e dos impostos aplicáveis. Confira os dados atuais em fonte oficial antes de decidir.",en:"The simulation depends on the entered CDI rate, contracted percentage, term, contributions and applicable taxes. Check current official data before making a decision."}
 };
 if(guidance[c.type])return guidance[c.type][l==="pt"?"pt":"en"];
 const category={
  math:{pt:"Confira a unidade e a ordem das operações. Se o resultado parecer inesperado, refaça o cálculo com valores menores para verificar cada etapa.",en:"Check units and operation order. If the result seems unexpected, repeat the calculation with smaller values to verify each step."},
  finance:{pt:"O resultado depende das taxas, dos prazos e das premissas informadas. Compare cenários equivalentes e não trate a projeção como promessa de retorno.",en:"The result depends on entered rates, terms and assumptions. Compare equivalent scenarios and do not treat a projection as a promise of return."},
  work:{pt:"Confira o período de referência, a jornada, os descontos e as regras aplicáveis ao seu vínculo. A calculadora é uma estimativa e não substitui a conferência da folha ou orientação profissional.",en:"Check the reference period, work schedule, deductions and rules applicable to your employment. This is an estimate and does not replace payroll verification or professional advice."},
  business:{pt:"Inclua todos os custos relevantes e use unidades consistentes. Custos indiretos, impostos, perdas e taxas podem alterar o resultado final.",en:"Include all relevant costs and use consistent units. Overheads, taxes, losses and fees can change the final result."},
  daily:{pt:"Confira as unidades usadas em cada campo antes de comparar o resultado. Pequenas diferenças de distância, consumo ou quantidade podem alterar a estimativa.",en:"Check the units used in each field before comparing results. Small differences in distance, consumption or quantity can change the estimate."},
  date:{pt:"Verifique se o cálculo usa dias corridos ou úteis e se deve considerar feriados locais. O resultado pode mudar conforme o calendário adotado.",en:"Check whether the calculation uses calendar or business days and whether local holidays apply. The result can change with the calendar used."},
  health:{pt:"Use o resultado como referência matemática geral. Ele não é diagnóstico nem substitui uma avaliação individual por profissional de saúde.",en:"Use the result as a general mathematical reference. It is not a diagnosis and does not replace an individual health assessment."},
  investment:{pt:"Esta é uma simulação baseada nos dados informados, não uma recomendação de investimento. Considere risco, liquidez, impostos, taxas e inflação.",en:"This is a simulation based on entered data, not an investment recommendation. Consider risk, liquidity, taxes, fees and inflation."}
 };
 return (category[c.cat]||category.math)[l==="pt"?"pt":"en"];
}
function card(c,l){
 const d=localeData[l];
 return '<a class="card" href="'+calcUrl(l,c.slug)+'"><div class="icon">'+esc(c.icon)+'</div><h3>'+esc(c.title[l])+'</h3><p>'+esc(c.desc[l])+'</p><span class="tag">'+esc(categoryNames[c.cat][l])+'</span></a>';
}
function seoExtra(c,l){
 const pt=l==="pt";
 const special={
  netSalary:pt?["Entenda o salário líquido","Esta calculadora estima o valor recebido a partir do salário bruto, considerando INSS, IRRF, dependentes e outros descontos informados.","Informe o salário bruto e confira o relatório para separar os principais descontos."]:["Understand take-home pay","This calculator estimates take-home pay from gross salary, considering INSS, IRRF, dependents and other deductions entered.","Enter gross salary and review the report to understand the main deductions."],
  termination:pt?["Entenda a rescisão trabalhista","O resultado muda conforme o motivo do desligamento. A ferramenta permite comparar dispensa sem justa causa, justa causa, pedido de demissão, acordo e outras situações.","Selecione o motivo, informe datas, salário e FGTS e confira a memória de cálculo."]:["Understand employment termination","The result depends on the termination reason. The tool compares different termination scenarios using the entered dates, salary and FGTS.","Select the reason, enter dates, salary and FGTS, then review the calculation report."],
  loan:pt?["Entenda o financiamento","A parcela depende do valor financiado, entrada, prazo e taxa. Tarifas, seguros e impostos podem alterar o custo efetivo.","Use a taxa que você realmente quer simular e compare o custo total, não apenas a parcela."]:["Understand loan payments","Payments depend on amount, down payment, term and rate. Fees, insurance and taxes can change the effective cost.","Use the rate you want to simulate and compare total cost, not only the installment."],
  compoundInterest:pt?["Entenda os juros compostos","Os juros de cada período são incorporados ao saldo, fazendo a base de cálculo crescer ao longo do tempo.","Compare diferentes taxas e períodos para visualizar o efeito da capitalização."]:["Understand compound interest","Each period's interest is added to the balance, so the calculation base grows over time.","Compare different rates and periods to see the effect of compounding."],
  fuel:pt?["Planeje o custo da viagem","A estimativa usa distância, consumo e preço por litro. O consumo real pode variar conforme trânsito, velocidade, carga e condições do veículo."]:["Plan your trip cost","The estimate uses distance, consumption and price per liter. Real consumption can vary with traffic, speed, load and vehicle conditions."],
  vacation:pt?["Entenda o cálculo de férias","A estimativa considera o salário informado e o adicional de um terço. Descontos e particularidades da folha podem alterar o valor recebido."]:["Understand vacation pay","The estimate uses the entered salary and one-third premium. Payroll deductions and specific conditions can change the amount received."],
  thirteenth:pt?["Entenda o 13º salário","O valor proporcional depende da remuneração e dos meses considerados no cálculo. Parcelas salariais e descontos podem alterar o valor final."]:["Understand 13th salary","The proportional amount depends on remuneration and eligible months. Payroll components and deductions can change the final amount."],
  overtime:pt?["Entenda as horas extras","O adicional informado é aplicado ao valor da hora e à quantidade de horas. A apuração completa pode depender de jornada e convenção coletiva."]:["Understand overtime","The entered premium is applied to the hourly rate and overtime hours. Full payroll calculation may depend on schedule and collective agreements."],
  fgts:pt?["Entenda o FGTS","A calculadora estima o depósito mensal com base na remuneração informada. O saldo acumulado depende dos depósitos realizados ao longo do contrato."]:["Understand FGTS","The calculator estimates a monthly deposit from the entered remuneration. The accumulated balance depends on deposits made during employment."],
  increase:pt?["Calcule reajustes com clareza","A variação percentual compara o valor final com o valor inicial. Isso permite simular reajustes salariais, preços e outras mudanças."]:["Calculate percentage increases clearly","The percentage change compares the final value with the initial value, useful for salary, price and other adjustments."],
  discount:pt?["Entenda o desconto","O percentual é aplicado sobre o preço original para mostrar economia e preço final. Descontos sucessivos devem ser calculados em sequência."]:["Understand discounts","The percentage is applied to the original price to show savings and final price. Successive discounts should be calculated sequentially."],
  bmi:pt?["Entenda o IMC","O IMC é um indicador matemático baseado em peso e altura. Ele não substitui avaliação individual de saúde."]:["Understand BMI","BMI is a mathematical indicator based on weight and height. It does not replace an individual health assessment."],
  investmentSimulator:pt?["Simule investimentos com aportes mensais","Projete o valor futuro usando capital inicial, aportes, prazo e taxa informada. A ferramenta é uma simulação matemática e não uma recomendação.","Compare cenários de prazo e rentabilidade e confira o relatório completo."]:["Simulate investments with monthly contributions","Project future value using initial capital, contributions, term and entered rate. This is a mathematical simulation, not investment advice.","Compare terms and returns and review the full report."],
  cdi:pt?["Simule rendimento atrelado ao CDI","Informe a taxa CDI usada no cenário, o percentual do CDI, os aportes, o prazo e o imposto para estimar o resultado.","A taxa CDI deve ser atualizada pelo usuário; o CalcWorld não promete cotação ou rentabilidade em tempo real."]:["Simulate CDI-linked returns","Enter the CDI rate, CDI percentage, contributions, term and tax to estimate the result.","The CDI rate should be updated by the user; CalcWorld does not promise a real-time quote or return."],
  tesouro:pt?["Simulador Tesouro Direto","Simule Tesouro Selic, Tesouro IPCA+, Tesouro Prefixado, Educa+ e RendA+ usando a taxa que você informar.","Os títulos têm características, preços, taxas, vencimentos e riscos específicos. Use os dados oficiais do Tesouro Direto para conferir as condições atuais."]:["Treasury bond simulator","Simulate Treasury bond scenarios using the rate you enter.","Bonds have specific terms, prices, rates, maturities and risks. Check official Treasury data for current conditions."],
  cdb:pt?["Simulador de CDB","Projete um CDB com aporte inicial, aportes mensais, taxa anual e imposto estimado.","A taxa e a tributação efetivas dependem do produto, prazo e regras vigentes."]:["CDB simulator","Project a CDB using initial capital, monthly contributions, annual rate and estimated tax.","Actual rates and taxes depend on the product, term and current rules."],
  lciLca:pt?["Simulador de LCI e LCA","Projete LCI ou LCA com taxa e prazo informados e compare o valor acumulado.","Confira a tributação e as condições do produto antes de usar a simulação para uma decisão financeira."]:["LCI and LCA simulator","Project LCI or LCA using an entered rate and term.","Check the product tax treatment and conditions before making a financial decision."],
  fii:pt?["Simulador de Fundos Imobiliários","Estime patrimônio, cotas e rendimentos a partir do preço da cota, dividendos, aportes e valorização informados.","FIIs são renda variável e podem ter variação de cotação, liquidez e distribuição de rendimentos."]:["FII investment simulator","Estimate shares, portfolio value and distributions using entered price, dividends, contributions and appreciation.","FIIs are variable-income investments and prices, liquidity and distributions can vary."],
  poupanca:pt?["Simulador de poupança","Projete a evolução do saldo com capital inicial, aportes e taxa mensal informada.","A taxa usada é a informada pelo usuário; condições reais e regras de remuneração podem mudar."]:["Savings simulator","Project savings growth using initial capital, contributions and an entered monthly rate.","The rate is user-provided; actual conditions and remuneration rules may change."],
  dividendYield:pt?["Entenda o Dividend Yield","Calcule a relação entre dividendos anuais por cota e preço. Use o indicador junto de outros dados do ativo.","Dividend Yield isolado não garante retorno futuro."]:["Understand dividend yield","Calculate the relationship between annual dividends per share and price. Use it with other asset information.","Dividend yield alone does not guarantee future returns."],
  stockInvestment:pt?["Simulador de ações","Simule uma posição em ações com preço de compra, preço de venda e dividendos informados.","O mercado de ações envolve risco de perda e a simulação não prevê o comportamento futuro dos preços."]:["Stock investment simulator","Simulate a stock position using purchase price, sale price and entered dividends.","Stocks involve loss risk and the simulation does not predict future prices."],
  cryptoInvestment:pt?["Simulador de criptomoedas","Calcule um cenário de lucro ou prejuízo com preço de entrada, saída e custos informados.","Criptoativos podem apresentar forte volatilidade. A simulação é matemática e não é recomendação."]:["Crypto investment simulator","Calculate a profit or loss scenario using entered entry, exit and costs.","Crypto assets can be highly volatile. This is a mathematical simulation, not advice."],
  realReturn:pt?["Calcule o rendimento real","Veja quanto uma rentabilidade nominal representa depois do efeito da inflação.","Use uma taxa de inflação coerente com o período analisado."]:["Calculate real return","See what a nominal return represents after inflation.","Use an inflation rate consistent with the analyzed period."],
  investmentGoal:pt?["Planeje uma meta de investimento","Informe a meta, o capital inicial, o prazo e a taxa para estimar o aporte mensal necessário.","A meta depende das premissas informadas e não representa garantia de rentabilidade."]:["Plan an investment goal","Enter the target, initial capital, term and rate to estimate the required monthly contribution.","The target depends on the assumptions entered and is not a guarantee of return."],
  retirementInvestment:pt?["Simule sua aposentadoria","Projete um patrimônio com idade atual, idade de aposentadoria, capital, aportes e taxa informados.","A projeção não considera todos os efeitos de inflação, custos, impostos e mudanças de renda ao longo da vida."]:["Simulate retirement investing","Project wealth using current age, retirement age, capital, contributions and rate.","The projection does not include every effect of inflation, costs, taxes and income changes."],
  compareInvestments:pt?["Compare dois investimentos","Coloque duas taxas e impostos em um cenário matemático comum para observar a diferença no valor acumulado.","Além da rentabilidade, compare liquidez, risco, custos, carência e tributação aplicável."]:["Compare two investments","Place two rates and taxes in a common mathematical scenario to observe the accumulated difference.","Besides return, compare liquidity, risk, costs, lock-up and applicable taxes."],
  equivalentRate:pt?["Converta taxas de investimento","Converta uma taxa anual em mensal ou mensal em anual usando capitalização composta.","A equivalência matemática não considera impostos, taxas ou outras condições do produto."]:["Convert investment rates","Convert annual to monthly or monthly to annual rates using compound capitalization.","Mathematical equivalence does not include taxes, fees or product conditions."]
 };
 const categoryAdvice={
  math:pt?"Confira a ordem das operações e mantenha as unidades consistentes.":"Check operation order and keep units consistent.",
  finance:pt?"Teste taxas e prazos diferentes e observe o custo ou montante total. A projeção depende das premissas informadas.":"Test different rates and terms and compare total cost or value. The projection depends on the assumptions entered.",
  work:pt?"Confira datas, jornada, remuneração e regras do vínculo. Situações individuais podem alterar o cálculo.":"Check dates, schedule, remuneration and employment rules. Individual circumstances may change the calculation.",
  business:pt?"Inclua custos, taxas, perdas e impostos relevantes antes de usar o resultado para definir preços ou metas.":"Include relevant costs, fees, losses and taxes before using the result to set prices or targets.",
  daily:pt?"Confirme as unidades e os valores inseridos; resultados aproximados podem variar com as condições reais.":"Confirm units and entered values; estimates can vary with real-world conditions.",
  date:pt?"Confira o calendário, o período e a diferença entre dias corridos e úteis quando aplicável.":"Check the calendar and period, including the distinction between calendar and business days where applicable.",
  health:pt?"Use o resultado como referência matemática geral, não como diagnóstico ou recomendação médica individual.":"Use the result as a general mathematical reference, not an individual diagnosis or medical recommendation.",
  investment:pt?"Compare risco, liquidez, impostos, custos e inflação. A simulação não garante rentabilidade futura.":"Compare risk, liquidity, taxes, costs and inflation. The simulation does not guarantee future returns."
 };
 const x=special[c.type]||[
  pt?"Como interpretar o resultado":"Interpreting the result",
  pt?"A ferramenta "+c.title.pt.toLowerCase()+" usa os dados informados para produzir uma estimativa. "+categoryAdvice[c.cat]:"The "+c.title.en.toLowerCase()+" uses your inputs to produce an estimate. "+categoryAdvice[c.cat],
  pt?"Confira a fórmula e o exemplo desta página e valide os dados de entrada antes de usar o resultado.":"Review this page's formula and example, and verify your inputs before using the result."
 ];
 return '<section class="seo-guide"><h2>'+esc(x[0])+'</h2><p>'+esc(x[1])+'</p>'+(x[2]?'<p>'+esc(x[2])+'</p>':'')+'</section>';
}
function seoTitle(c,l){
  if(l!=="pt") return c.title[l];
  const titles={
    "rescisao":"Calculadora de rescisão trabalhista 2026: simule sua rescisão CLT",
    "salario-liquido":"Calculadora de salário líquido 2026: veja os descontos",
    "financiamento":"Calculadora de financiamento: simule parcelas e juros",
    "juros-compostos":"Calculadora de juros compostos: simule o rendimento",
    "ferias":"Calculadora de férias 2026: salário e adicional de 1/3",
    "combustivel":"Calculadora de combustível: custo por km e viagem",
    "decimo-terceiro":"Calculadora de 13º salário 2026: valor integral ou proporcional",
    "decimo-terceiro-proporcional":"Calculadora de 13º proporcional 2026: simule o valor",
    "ferias-proporcionais":"Calculadora de férias proporcionais 2026 — calcular férias proporcionais",
    "horas-extras":"Calculadora de horas extras 2026 — calcular hora extra",
    "fgts":"Calculadora de FGTS 2026 — calcular depósito e saldo estimado",
    "salario-por-dia":"Calculadora de salário por dia — calcular valor diário",
    "salario-por-hora":"Calculadora de salário por hora — calcular valor da hora",
    "porcentagem-de-aumento":"Calculadora de reajuste salarial — calcular aumento de salário",
    "adicional-hora-extra":"Calculadora de adicional de hora extra — calcular hora extra",
    "escala-12x36":"Calculadora de escala 12x36 — organizar jornada de trabalho",
    "salario":"Calculadora de salário 2026 — bruto, líquido, INSS e IRRF",
    "regra-de-tres":"Calculadora de regra de três — calcular regra de três online",
    "porcentagem":"Calculadora de porcentagem — calcular porcentagem online",
    "aumento-percentual":"Calculadora de aumento percentual — calcular aumento",
    "desconto":"Calculadora de desconto — calcular desconto e preço final",
    "regra-de-porcentagem":"Calculadora de regra de porcentagem — calcular porcentagem"
  };
  return titles[c.slug]||c.title[l];
}
function page(c,l){
 const d=localeData[l],title=esc(seoTitle(c,l)),desc=esc(c.desc[l]),p=prefix(l),canonical=site+calcUrl(l,c.slug),metaDesc=esc(l==="pt"?"Calculadora online grátis: "+c.title[l]+". "+c.desc[l]+" Veja a fórmula, um exemplo e as limitações do cálculo.":"Free online calculator: "+c.title[l]+". "+c.desc[l]+" Review the formula, example and limitations.");
 const alts=[["pt-BR",site+calcUrl("pt",c.slug)],["en",site+calcUrl("en",c.slug)]];
 const related=calculators.filter(x=>x.cat===c.cat&&x.id!==c.id).slice(0,6).map(x=>card(x,l)).join("");
 const catName=esc(categoryNames[c.cat][l]);
 const catFolder=d.categoryFolder;
 const catRel=l==="pt"?"../../"+catFolder+"/"+c.cat+"/":"../../"+catFolder+"/"+c.cat+"/";
 const investmentPage=c.cat==="investment";
 const investmentHero=investmentPage?'<div class="investment-calc-banner"><span>📈 CALCWORLD INVEST • PRO</span><strong>Mercado, simulação e análise de investimentos</strong><p>Use os simuladores abaixo e consulte ativos, períodos e informações atuais no CalcWorld Invest.</p><a href="/investimentos.html">Abrir central de investimentos →</a></div>':"";
 const breadcrumb='<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="'+p+'">'+d.home+'</a><span>›</span><a href="'+catRel+'">'+catName+'</a><span>›</span><span>'+title+'</span></nav>';
 const schema=JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"WebApplication","name":c.title[l],"description":c.desc[l],"url":canonical,"applicationCategory":"UtilitiesApplication","applicationSubCategory":"Calculator","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"BRL"}},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":d.home,"item":site+(l==="pt"?"/":"/en/")},{"@type":"ListItem","position":2,"name":categoryNames[c.cat][l],"item":site+catUrl(l,c.cat)},{"@type":"ListItem","position":3,"name":c.title[l],"item":canonical}]}]});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — CalcWorld</title><meta name="description" content="'+metaDesc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+calcUrl("en",c.slug)+'"><link rel="stylesheet" href="'+p+'styles.css"><script src="'+p+'theme.js"></script><meta name="google-adsense-account" content="ca-pub-6472882150880001"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6472882150880001" crossorigin="anonymous"></script><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'"><img src="'+p+'logo.svg" alt="CalcWorld"></a><div class="page-tools"><button id="themeToggle" class="theme-toggle" type="button" onclick="window.toggleCalcWorldTheme&&window.toggleCalcWorldTheme();return false;" aria-label="Alterar tema"><span class="theme-icon">☀</span><span class="theme-text">Tema</span></button><select id="pageLang" aria-label="Idioma"><option value="pt-BR">🇧🇷 PT</option><option value="en">🇺🇸 EN</option></select><a id="back" href="'+p+'" style="color:var(--muted);text-decoration:none;font-weight:700">← '+d.back+'</a></div></div></header><main class="wrap calc-page '+(investmentPage?"investment-calc-page":"")+'" style="padding:35px 0 80px">'+breadcrumb+investmentHero+'<div class="eyebrow">CALCWORLD</div><h1 id="title">'+title+'</h1><p id="desc" class="hero-copy" style="font-size:18px">'+desc+'</p><div class="calc-layout"><section class="calc-main"><section id="form" class="calc-box"></section><section class="info calc-info"><h2>'+d.how+'</h2><p>'+d.howText+'</p><p>'+seoText(c,l)+'</p>'+workedExample(c,l)+'<h2>'+(l==="pt"?"Sobre esta calculadora":"About this calculator")+'</h2><p>'+(l==="pt"?"Esta página mostra os dados informados, a fórmula ou método aplicável e uma interpretação simples do resultado.":"This page shows the inputs, the applicable formula or method, and a simple interpretation of the result.")+'</p>'+(formulaText(c,l)?'<h3>'+(l==="pt"?"Fórmula / método":"Formula / method")+'</h3><p><strong>'+esc(formulaText(c,l))+'</strong></p>':'')+'<h2>'+d.important+'</h2><p>'+d.importantText+'</p></section>'+seoExtra(c,l)+'</section></section><aside class="calc-sidebar"><div class="calc-side-card"><span class="eyebrow">CALCWORLD</span><h2>'+d.sideTitle+'</h2><p>'+d.sideText+'</p></div><div class="calc-side-card"><h3>'+d.sideResult+'</h3><ul>'+d.sideItems.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></div><div class="calc-side-card calc-side-note"><strong>'+d.sideAttention+'</strong><p>'+d.sideWarning+'</p></div></aside></div><section class="section"><div class="section-title"><h2>'+d.related+'</h2></div><div class="grid">'+related+'</div></section></main><footer class="site-footer"><div class="wrap copyright">© '+new Date().getFullYear()+' CalcWorld <span class="business-id">• CNPJ: 69.623.245/0001-71</span> • <a href="/sobre.html">'+(l==="pt"?"Sobre":"About")+'</a> • <a href="/contato.html">'+(l==="pt"?"Contato":"Contact")+'</a> • <a href="/privacy.html">'+(l==="pt"?"Privacidade":"Privacy")+'</a> • <a href="/terms.html">'+(l==="pt"?"Termos de uso":"Terms")+'</a></div></footer><script src="'+p+'calculators.js"></script><script src="'+p+'calculator.js"></script><script>(function(){var pl=document.getElementById("pageLang");if(pl){pl.value="'+(l==="pt"?"pt-BR":"en")+'";pl.onchange=function(){location.href=pl.value==="pt-BR"?"/calculadoras/'+c.slug+'/":"/en/calculators/'+c.slug+'/";};}var t=localStorage.getItem("cw-theme-v2")||"light";document.documentElement.dataset.theme=t;var b=document.getElementById("themeToggle");if(b){b.querySelector(".theme-icon").textContent=t==="dark"?"☀":"☾";b.querySelector(".theme-text").textContent=t==="dark"?"Claro":"Escuro";b.onclick=function(){t=document.documentElement.dataset.theme==="dark"?"light":"dark";localStorage.setItem("cw-theme-v2",t);document.documentElement.dataset.theme=t;b.querySelector(".theme-icon").textContent=t==="dark"?"☀":"☾";b.querySelector(".theme-text").textContent=t==="dark"?"Claro":"Escuro";};;}})();</script><script src="/analytics.js"></script></body></html>';
}
function categoryPage(cat,l){
 const d=localeData[l],name=esc(categoryNames[cat][l]),p=l==="pt"?"../../":"../../../",canonical=site+catUrl(l,cat);
 const items=calculators.filter(x=>x.cat===cat),links=items.map(x=>card(x,l)).join("");
 const desc=esc(cat==="investment"&&l==="pt"?"Simuladores de investimentos online e gratuitos: CDI, Tesouro Direto, CDB, LCI, LCA, fundos imobiliários, ações, criptomoedas, poupança e metas financeiras no CalcWorld.":cat==="investment"&&l==="en"?"Free online investment simulators for CDI, Treasury bonds, CDB, LCI, LCA, real estate funds, stocks, crypto, savings and financial goals on CalcWorld.":l==="pt"?"Calculadoras de "+categoryNames[cat].pt+" online e gratuitas no CalcWorld.":l==="en"?"Free online "+categoryNames[cat].en.toLowerCase()+" calculators and tools on CalcWorld.":"Calculadoras gratuitas de "+categoryNames[cat].es.toLowerCase()+" en CalcWorld.");
 const alts=[["pt-BR",site+catUrl("pt",cat)],["en",site+catUrl("en",cat)]];
 const categoryIntros={
 pt:{
  math:"Resolva operações e proporções com exemplos simples. Confira a fórmula, as unidades e como interpretar o resultado antes de usar o valor.",
  finance:"Compare juros, descontos, parcelas e projeções financeiras. As simulações dependem das taxas e dos prazos informados e não representam oferta financeira.",
  work:"Estime verbas e valores relacionados ao trabalho usando os dados do seu caso. Regras coletivas, datas, descontos e legislação vigente podem mudar o resultado.",
  business:"Calcule custos, preços, margens, comissões e necessidades de estoque. Confira se todos os custos relevantes e unidades estão incluídos.",
  daily:"Resolva situações práticas do dia a dia, como combustível, unidades e divisão de despesas. Verifique as unidades e os valores inseridos.",
  date:"Calcule períodos, prazos e datas. Observe se o cálculo considera dias corridos ou úteis e se feriados locais precisam ser tratados separadamente.",
  health:"Use os cálculos como referências matemáticas gerais, não como diagnóstico ou recomendação médica individual.",
  investment:"Encontre simuladores para CDI, Tesouro Direto, CDB, LCI e LCA, fundos imobiliários (FII), ações, criptoativos, poupança, dividend yield, rendimento real e metas de investimento."
 },
 en:{
  math:"Solve arithmetic and proportions with simple examples. Check the formula, units and interpretation before using the result.",
  finance:"Compare interest, discounts, installments and financial projections. Simulations depend on entered rates and terms and are not financial offers.",
  work:"Estimate employment-related amounts using your inputs. Collective agreements, dates, deductions and current law can change results.",
  business:"Calculate costs, prices, margins, commissions and stock needs. Check that relevant costs and units are included.",
  daily:"Handle practical tasks such as fuel, unit conversion and splitting expenses. Check your units and inputs.",
  date:"Calculate periods, deadlines and dates. Check whether a calculation uses calendar or business days and whether local holidays need separate treatment.",
  health:"Use these calculations as general mathematical references, not as an individual diagnosis or medical recommendation.",
  investment:"Find simulators for CDI, Treasury bonds, CDB, LCI and LCA, real estate funds, stocks, crypto, savings, dividend yield, real return and investment goals."
 }
};
const categoryIntro=categoryIntros[l]?.[cat]||d.categoryIntro;
 const schema=JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":categoryNames[cat][l],"description":desc,"url":canonical});
 return '<!doctype html><html lang="'+d.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+' — CalcWorld</title><meta name="description" content="'+desc+'"><meta name="robots" content="index,follow"><meta name="theme-color" content="#2563eb"><link rel="canonical" href="'+canonical+'">'+alts.map(([hl,u])=>'<link rel="alternate" hreflang="'+hl+'" href="'+u+'">').join("")+'<link rel="alternate" hreflang="x-default" href="'+site+catUrl("en",cat)+'"><link rel="stylesheet" href="'+p+'styles.css"><meta name="google-adsense-account" content="ca-pub-6472882150880001"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6472882150880001" crossorigin="anonymous"></script><script type="application/ld+json">'+schema+'</script></head><body><header class="header"><div class="wrap nav"><a class="brand" href="'+p+'"><img src="'+p+'logo.svg" alt="CalcWorld"></a><div class="page-tools"><button id="themeToggle" class="theme-toggle" type="button" aria-label="Change theme">☾</button><a href="'+p+'" style="color:var(--muted);text-decoration:none;font-weight:700">← '+d.home+'</a></div></div></header><main class="wrap" style="padding:45px 0 80px"><div class="eyebrow">CALCWORLD</div><h1>'+name+'</h1><p class="hero-copy" style="font-size:18px">'+categoryIntro+'</p><section class="section"><div class="grid">'+links+'</div></section></main><script>(function(){var t=localStorage.getItem("cw-theme-v2")||"light";document.documentElement.dataset.theme=t;var b=document.getElementById("themeToggle");if(b){b.textContent=t==="dark"?"☀":"☾";b.onclick=function(){t=document.documentElement.dataset.theme==="dark"?"light":"dark";localStorage.setItem("cw-theme-v2",t);document.documentElement.dataset.theme=t;b.textContent=t==="dark"?"☀":"☾";};}})();</script><script src="/analytics.js"></script></body></html>';
}
for(const c of calculators) for(const l of ["pt","en"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,"calculadoras",c.slug):path.join(root,l,d.folder,c.slug);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),page(c,l));
}
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en"]){
 const d=localeData[l],dir=l==="pt"?path.join(root,d.categoryFolder,cat):path.join(root,l,d.categoryFolder,cat);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"index.html"),categoryPage(cat,l));
}
// Only canonical, indexable HTML pages belong in the sitemap. robots.txt and ads.txt are discovery/configuration files, not landing pages.
const urls=[site+"/",site+"/privacy.html",site+"/terms.html",site+"/legislacao.html",site+"/investimentos.html"];
for(const c of calculators) for(const l of ["pt","en"]) urls.push(site+calcUrl(l,c.slug));
for(const cat of Object.keys(categoryNames)) for(const l of ["pt","en"]) urls.push(site+catUrl(l,cat));
// Important SEO hubs and editorial pages are public pages too; keep them in the sitemap
// so regeneration does not remove manually maintained content from search discovery.
[
  "trabalhistas/",
  "rescisao/",
  "rescisao/sem-justa-causa/",
  "rescisao/pedido-de-demissao/",
  "rescisao/acordo/",
  "rescisao/justa-causa/",
  "rescisao/aviso-previo/",
  "rescisao/fgts/",
  "rescisao/ferias/",
  "rescisao/decimo-terceiro/",
  "rescisao/calculo/",
  "rescisao/prazo-pagamento/",
  "rescisao/saldo-de-salario/",
  "rescisao/contrato/",
  "rescisao/clt/",
  "rescisao/contrato-temporario/",
  "guias/",
  "guias/como-calcular-rescisao/",
  "guias/quanto-vou-receber-se-pedir-demissao/",
  "guias/salario-liquido-como-calcular/",
  "guias/como-calcular-ferias/",
  "guias/como-calcular-13-salario/",
  "guias/como-calcular-hora-extra/",
  "guias/juros-compostos-como-calcular/",
  "guias/financiamento-price-sac/",
  "guias/porcentagem-de-aumento-como-calcular/",
  "guias/dias-uteis-como-calcular/",
  "guias/quanto-rende-1000-cdi/",
  "guias/quanto-rende-10000-poupanca/"
].forEach(p=>urls.push(site+"/"+p));
const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+u+'</loc><lastmod>'+buildDate+'</lastmod></url>').join("")+'</urlset>';
fs.writeFileSync(path.join(root,"sitemap.xml"),xml);
console.log("Generated "+calculators.length+" calculators x 2 locales + "+Object.keys(categoryNames).length+" categories x 2 locales.");
