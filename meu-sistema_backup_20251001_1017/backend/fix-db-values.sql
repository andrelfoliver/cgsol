BEGIN;

-- 0) Higienização básica (trim de espaços)
UPDATE projetos
SET
  nome = BTRIM(nome),
  coordenacao = BTRIM(coordenacao),
  tipo = BTRIM(tipo),
  status = BTRIM(status);

-- 1) Coordenacao → CODES / COSET / CGOD
-- (qualquer variação de caixa vira maiúscula; se vier "Codes" etc. fica certo)
UPDATE projetos
SET coordenacao = UPPER(coordenacao);

-- 2) STATUS → valores canônicos que o front usa:
--    'Planejado', 'Em Andamento', 'Em Risco', 'Concluído', 'Sustentação', 'Pausado'

-- Planejado
UPDATE projetos
SET status = 'Planejado'
WHERE UPPER(status) IN ('PLANEJADO','PLANEJADA','PLANNED');

-- Em Andamento
UPDATE projetos
SET status = 'Em Andamento'
WHERE UPPER(status) IN ('EM ANDAMENTO','ANDAMENTO','EMANDAMENTO','EM_ANDAMENTO');

-- Em Risco  (o card "Fora de prazo" conta Em Risco ou RAG Vermelho)
UPDATE projetos
SET status = 'Em Risco'
WHERE UPPER(status) IN ('EM RISCO','RISCO','ATRASADO','FORA DE PRAZO','FORA-PRAZO','FORA PRAZO');

-- Concluído (normaliza acento)
UPDATE projetos
SET status = 'Concluído'
WHERE UPPER(status) IN ('CONCLUIDO','CONCLUÍDO','FINALIZADO','ENTREGUE','DONE');

-- Sustentação (normaliza acento)
UPDATE projetos
SET status = 'Sustentação'
WHERE UPPER(status) IN ('SUSTENTACAO','SUSTENTAÇÃO','SUPORTE','PRODUCAO','PRODUÇÃO','SUSTENTACAO/PRODUCAO','SUSTENTAÇÃO/PRODUÇÃO');

-- Pausado
UPDATE projetos
SET status = 'Pausado'
WHERE UPPER(status) IN ('PAUSADO','PAUSADA','SUSPENSO','SUSPENSA');

-- 3) TIPO → valores canônicos que o front usa:
--    'Infraestrutura','Sistema Integrado','Integração','BI Dashboard',
--    'Dashboard','Sistema de Dados','Modernização','Qualidade de Dados','Governança'

-- Infraestrutura
UPDATE projetos
SET tipo = 'Infraestrutura'
WHERE UPPER(tipo) LIKE 'INFRA%';

-- Sistema Integrado
UPDATE projetos
SET tipo = 'Sistema Integrado'
WHERE UPPER(tipo) IN ('SISTEMA INTEGRADO','SISTEMA-INTEGRADO');

-- Integração
UPDATE projetos
SET tipo = 'Integração'
WHERE UPPER(tipo) IN ('INTEGRACAO','INTEGRAÇÃO','INTEGRATION');

-- BI Dashboard
UPDATE projetos
SET tipo = 'BI Dashboard'
WHERE UPPER(tipo) IN ('BI','BI DASHBOARD','BUSINESS INTELLIGENCE','POWERBI','POWER BI');

-- Dashboard
UPDATE projetos
SET tipo = 'Dashboard'
WHERE UPPER(tipo) IN ('DASHBOARD','PAINEL');

-- Sistema de Dados / Data Lake
UPDATE projetos
SET tipo = 'Sistema de Dados'
WHERE UPPER(tipo) IN ('SISTEMA DE DADOS','DADOS','DATA LAKE','DATALAKE','DATA-LAKE');

-- Modernização
UPDATE projetos
SET tipo = 'Modernização'
WHERE UPPER(tipo) LIKE 'MODERN%';

-- Qualidade de Dados
UPDATE projetos
SET tipo = 'Qualidade de Dados'
WHERE UPPER(tipo) LIKE 'QUALIDADE%';

-- Governança
UPDATE projetos
SET tipo = 'Governança'
WHERE UPPER(tipo) LIKE 'GOVERNAN%';

-- 4) Verificações rápidas (opcional: comente se for rodar via -f e não quiser prints)
-- Mostra os distintos para confirmar que bate com o front
-- SELECT DISTINCT coordenacao FROM projetos ORDER BY 1;
-- SELECT DISTINCT status FROM projetos ORDER BY 1;
-- SELECT DISTINCT tipo FROM projetos ORDER BY 1;

COMMIT;
