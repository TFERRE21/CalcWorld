# Plano de correção do CalcWorld para nova revisão do AdSense

## Diagnóstico encontrado no repositório

A rejeição atual mostrada no painel é **Conteúdo de baixo valor**. O código tem uma arquitetura de muitas URLs geradas automaticamente, e o gerador `scripts/generate-site.cjs` repete em grande parte das calculadoras a mesma orientação genérica, perguntas frequentes idênticas e textos de SEO com variações pequenas. O catálogo também contém calculadoras muito parecidas entre si e algumas descrições muito curtas. Isso pode fazer o conjunto parecer escalado e pouco diferenciado, mesmo quando as ferramentas funcionam.

Também foram vistos problemas concretos a corrigir:
- A homepage tem textos-base em inglês misturados com português e depende de JavaScript para alguns rótulos.
- Há links rápidos na homepage para slugs que não correspondem ao catálogo; os links internos devem ser conferidos em lote.
- O gerador define `dateModified` de todas as páginas como a data de build. A data de publicação não deve sugerir revisão editorial se o texto não foi realmente revisto.
- Páginas de categorias têm pouco contexto editorial além da lista de ferramentas.
- As páginas de calculadora incluem placeholders de publicidade próximos ao formulário; anúncios só devem ser habilitados quando permitidos, e nunca devem dominar a experiência.
- O site precisa deixar claro quem o mantém, como entrar em contato, quais fontes oficiais sustentam cálculos legais/financeiros e quando o conteúdo foi de fato revisado.

## Ações prioritárias

### 1. Consolidar qualidade antes de ampliar quantidade
Não criar novas calculadoras por enquanto. Auditar o catálogo e agrupar ou retirar do índice páginas que diferem apenas no nome e executam a mesma fórmula. Páginas úteis podem continuar acessíveis, mas não é necessário indexar toda variação trivial.

### 2. Criar conteúdo realmente específico
Cada página indexável deve incluir, conforme o tema:
- exemplo numérico completo com etapas e resultado esperado;
- fórmula e definição de cada variável;
- limites e hipóteses do cálculo;
- fontes oficiais para regras de trabalho, tributos, saúde ou mercado quando aplicável;
- data de revisão editorial real e responsável/revisor identificável;
- perguntas frequentes específicas, não o mesmo FAQ copiado para todas as URLs;
- link para calculadora relacionada e próximo passo útil.

### 3. Tratar com cuidado páginas sensíveis
Nas páginas trabalhistas e financeiras, evitar promessas de precisão ou resultados oficiais. Mostrar hipóteses, dados necessários, fórmulas, o que ficou fora do cálculo e links para fontes primárias atualizadas.

### 4. Revisar arquitetura e experiência
- Navegação principal e rodapé consistentes em todas as páginas.
- Português natural como idioma principal das páginas brasileiras.
- Conferir todos os links internos e remover links quebrados.
- Revisar mobile, velocidade, acessibilidade, contraste e se os anúncios atrapalham o uso.
- Garantir que Política de Privacidade, Termos, Sobre e Contato sejam reais, completos e acessíveis.
- Confirmar que ads.txt tem exatamente o identificador e o tipo de vendedor fornecidos pelo AdSense.

### 5. Revisão técnica antes de reenviar
Executar o validador e testes de calculadoras; conferir páginas geradas em PT-BR e EN, links, canonical, hreflang, sitemap, robots.txt, páginas institucionais e carregamento sem login. Verificar as URLs públicas após publicação.

### 6. Reenvio ao AdSense
Só clicar em **Pedir revisão** quando as melhorias estiverem publicadas e verificadas. O checklist técnico por si só não garante aprovação; a decisão depende da avaliação do site completo pelo Google.

## Próxima implementação recomendada
Corrigir no gerador os blocos repetitivos e a navegação, adicionar exemplos e fórmulas realmente específicas por tipo de calculadora, corrigir os links da homepage e expandir o validador para detectar problemas de links, conteúdo-base repetido e metadados. Depois revisar manualmente primeiro as páginas de maior valor: rescisão, salário líquido, férias, décimo terceiro, CDI, juros compostos e financiamento.
