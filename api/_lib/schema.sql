-- Класс Kestrel PC: учителя (создаёт администратор), ученики (регистрируются сами и входят в класс по коду),
-- задания учителя, результаты, живое состояние компьютеров учеников и очередь команд удалённого управления.

CREATE TABLE IF NOT EXISTS users (
  id           serial PRIMARY KEY,
  login        text NOT NULL UNIQUE,
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('teacher', 'student')),
  pass_hash    text NOT NULL,
  -- ученик: в каком классе (id учителя)
  teacher_id   int REFERENCES users(id) ON DELETE SET NULL,
  -- учитель: код класса и сколько учеников можно подключить
  class_code   text UNIQUE,
  max_students int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS assignments (
  id         serial PRIMARY KEY,
  teacher_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  descr      text NOT NULL DEFAULT '',
  goal       text NOT NULL,
  cfg        jsonb NOT NULL DEFAULT '{}',
  archived   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_teacher ON assignments(teacher_id);

CREATE TABLE IF NOT EXISTS submissions (
  assignment_id int NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ms            int NOT NULL,
  done_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, student_id)
);

-- прогресс ученика: пройденные уроки и рекорд «Случайных поломок»
CREATE TABLE IF NOT EXISTS progress (
  student_id int PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lessons    jsonb NOT NULL DEFAULT '{}',
  drill_best int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- что сейчас на экране у ученика: обновляется каждые несколько секунд
CREATE TABLE IF NOT EXISTS presence (
  student_id int PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      jsonb NOT NULL,
  seen_at    timestamptz NOT NULL DEFAULT now()
);

-- команды учителя компьютеру ученика; ученик забирает их при синхронизации
CREATE TABLE IF NOT EXISTS commands (
  id         serial PRIMARY KEY,
  student_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  taken_at   timestamptz
);
CREATE INDEX IF NOT EXISTS commands_pending ON commands(student_id) WHERE taken_at IS NULL;

-- защита входа от перебора: неудачные попытки по логину
CREATE TABLE IF NOT EXISTS login_fails (
  login text NOT NULL,
  at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_fails_login ON login_fails(login, at);

-- ——— v2: несколько классов у учителя, попытки с серверным временем, защита от массовой регистрации ———

CREATE TABLE IF NOT EXISTS classes (
  id         serial PRIMARY KEY,
  teacher_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  code       text NOT NULL UNIQUE,
  -- набор открыт: можно зарегистрироваться или войти по коду
  open       boolean NOT NULL DEFAULT true,
  -- когда учитель последний раз смотрел кабинет этого класса: ученики синхронизируются чаще
  watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classes_teacher ON classes(teacher_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS class_id int REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS users_class ON users(class_id);

-- перенос v1: у каждого учителя был один код — он становится классом «Мой класс»
INSERT INTO classes (teacher_id, name, code)
  SELECT u.id, 'Мой класс', u.class_code FROM users u
  WHERE u.role = 'teacher' AND u.class_code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id = u.id);
UPDATE users s SET class_id = c.id FROM classes c
  WHERE s.role = 'student' AND s.class_id IS NULL AND s.teacher_id = c.teacher_id;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_id int REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS minutes int;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS level int;
UPDATE assignments a SET class_id = (SELECT min(c.id) FROM classes c WHERE c.teacher_id = a.teacher_id) WHERE a.class_id IS NULL;

-- попытка: когда ученик начал задание (время считает сервер)
CREATE TABLE IF NOT EXISTS attempts (
  assignment_id int NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, student_id)
);

-- регистрации по IP — не больше нескольких в час с одного адреса
CREATE TABLE IF NOT EXISTS reg_log (
  ip text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reg_log_ip ON reg_log(ip, at);

ALTER TABLE login_fails ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS login_fails_login_ip ON login_fails(login, ip, at);
