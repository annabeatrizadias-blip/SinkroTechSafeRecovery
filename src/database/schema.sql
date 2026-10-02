CREATE TABLE IF NOT EXISTS ocorrencias (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id         TEXT    NOT NULL,
  sensor_nome       TEXT    NOT NULL,
  tipo_sensor       TEXT    NOT NULL,
  causa_provavel    TEXT,
  valor_lido        REAL,
  limite            REAL,
  status            TEXT    NOT NULL DEFAULT 'ATIVA'
                    CHECK (status IN ('ATIVA', 'RESOLVIDO')),
  inicio_em         TEXT    NOT NULL,
  fim_em            TEXT,
  duracao_segundos  INTEGER,
  tecnico_nome      TEXT,
  tecnico_matricula TEXT,
  nr12_aceite       INTEGER NOT NULL DEFAULT 0,
  arquivado         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON ocorrencias (status, arquivado);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_sensor ON ocorrencias (sensor_id, id DESC);