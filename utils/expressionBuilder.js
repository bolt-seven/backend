const buildExpressionQuery = (expression, dataPath = 'dl.data') => {
  if (!expression) return null;

  const variableTags = expression.match(/\b[A-Z_]+\b/g) || [];
  const uniqueTags = [...new Set(variableTags)];

  let sqlExpression = expression;
  for (const tag of uniqueTags) {
    const jsonRef = `COALESCE((${dataPath}->>'${tag}')::numeric, 0)`;
    sqlExpression = sqlExpression.replace(new RegExp(`\\b${tag}\\b`, 'g'), jsonRef);
  }

  return sqlExpression;
};

const buildExpressionCase = (expression, dataPath = 'dl.data') => {
  if (!expression) return null;

  const sqlExpression = buildExpressionQuery(expression, dataPath);
  return `CASE WHEN ${sqlExpression} IS NOT NULL THEN ${sqlExpression} ELSE 0 END`;
};

module.exports = {
  buildExpressionQuery,
  buildExpressionCase
};
