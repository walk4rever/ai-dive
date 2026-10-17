DELETE FROM ai_pulse_topics
WHERE name IN (
  '增长打法 / Growth Playbook',
  'AI-Native 组织 / AI-Native Organization',
  '智能体底座 / Agent-Native Infra',
  '模型与推理 / Models & Reasoning',
  '知识增强与检索 / Knowledge & Retrieval',
  '状态与记忆 / State & Memory'
);
