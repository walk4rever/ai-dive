INSERT INTO ai_pulse_topics (name, description)
VALUES (
  '前沿模型 / Frontier Models',
  '追踪最顶尖基座模型的架构演进、推理范式与能力边界，系统拆解通向 AGI 的技术跃迁。'
)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
