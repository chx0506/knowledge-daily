// 用户偏好与日报反馈存储
//
// 方案 5.1：产品不把单一行为直接等同于稳定兴趣，采用「兴趣置信度」分层。
// 知乎侧拿不到浏览/搜索/点赞记录，但用户在本产品内的行为可以自己记录，
// 这是画像的重要补充信号，也是方案里「反馈后重新生成日报」的数据基础。
//
// Demo 用进程内存；生产替换为 Redis 或数据库即可，接口保持不变。

const preferences = new Map(); // userRef -> { directions, keywords, goal, blocked, updatedAt }
const feedbacks = new Map();   // userRef -> Map<cardId, { feedback, topic, at }>

/** 反馈类型 → 兴趣权重增量。负值表示降权 */
export const FEEDBACK_WEIGHTS = {
  interested: 1.5,
  want_more: 2.0,
  read: 0.4,
  mastered: 0.6,
  review_later: 0.8,
  irrelevant: -2.5,
};

export const FEEDBACK_TYPES = Object.keys(FEEDBACK_WEIGHTS);

const emptyPrefs = () => ({
  directions: [], keywords: [], goal: '', blocked: [], updatedAt: 0,
});

export function getPreferences(userRef) {
  return preferences.get(userRef) ?? emptyPrefs();
}

/**
 * 保存用户主动选择的学习方向。
 * 方案 5.1：主动选择属于「高置信度」信号，优先级高于行为推断。
 */
export function setPreferences(userRef, patch = {}) {
  const cur = getPreferences(userRef);
  const norm = (v, max) => (Array.isArray(v)
    ? [...new Set(v.map((s) => String(s).trim()).filter(Boolean))].slice(0, max)
    : undefined);

  const next = {
    directions: norm(patch.directions, 5) ?? cur.directions,
    keywords: norm(patch.keywords, 10) ?? cur.keywords,
    blocked: norm(patch.blocked, 20) ?? cur.blocked,
    goal: patch.goal !== undefined ? String(patch.goal).slice(0, 200) : cur.goal,
    updatedAt: Date.now(),
  };
  preferences.set(userRef, next);
  return next;
}

export function recordFeedback(userRef, { cardId, topic, feedback }) {
  if (!FEEDBACK_TYPES.includes(feedback)) {
    throw new Error(`不支持的反馈类型: ${feedback}`);
  }
  if (!feedbacks.has(userRef)) feedbacks.set(userRef, new Map());
  const rec = { feedback, topic: topic || '', at: Date.now() };
  feedbacks.get(userRef).set(cardId, rec);
  return rec;
}

export function getFeedbacks(userRef) {
  return [...(feedbacks.get(userRef)?.values() ?? [])];
}

/**
 * 汇总反馈得到主题级兴趣增量。
 * 用于画像加权与「不感兴趣后重新生成」。
 */
export function feedbackTopicScores(userRef) {
  const scores = new Map();
  for (const f of getFeedbacks(userRef)) {
    if (!f.topic) continue;
    scores.set(f.topic, (scores.get(f.topic) ?? 0) + (FEEDBACK_WEIGHTS[f.feedback] ?? 0));
  }
  return scores;
}

/** 被明确标记为不相关、且累计为负的主题 */
export function suppressedTopics(userRef) {
  const out = new Set(getPreferences(userRef).blocked);
  for (const [topic, score] of feedbackTopicScores(userRef)) {
    if (score <= -2) out.add(topic);
  }
  return out;
}

export function feedbackStats() {
  let total = 0;
  for (const m of feedbacks.values()) total += m.size;
  return { users_with_prefs: preferences.size, feedback_records: total };
}

export function clearUserData(userRef) {
  preferences.delete(userRef);
  feedbacks.delete(userRef);
}
