// netlify/functions/generate.mjs — GEO Strategy Builder (Netlify Functions)
// ---------------------------------------------------------------------------
// /api/generate 로 들어온 요청을 netlify.toml 의 리다이렉트가 이 함수로 연결합니다.
//   요청  : POST { industry, customer_type, services, problems }
//   응답  : { titles:[...], definitions:[...], faqs:{ "서비스명":[...] } }
//   실패  : 비200 + { fallback:true, message:"..." }  → 클라이언트가 로컬 템플릿으로 폴백
//
// API Key 는 브라우저에 노출하지 않고 서버 환경변수 OPENAI_API_KEY 만 사용합니다.
// (선택) OPENAI_MODEL, OPENAI_BASE_URL 로 override 가능.
// ---------------------------------------------------------------------------

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS,
      body: JSON.stringify({ fallback: true, message: 'POST 요청만 허용됩니다.' }) };
  }

  const apiKey  = process.env.OPENAI_API_KEY;
  const model   = process.env.OPENAI_MODEL    || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

  if (!apiKey) {
    return { statusCode: 500, headers: JSON_HEADERS,
      body: JSON.stringify({ fallback: true,
        message: '서버에 OPENAI_API_KEY 가 설정되지 않았습니다. 로컬 템플릿으로 생성합니다.' }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const industry = body.industry || '';
  const customer = body.customer_type || '';
  const services = Array.isArray(body.services) ? body.services.filter(Boolean) : [];
  const problems = Array.isArray(body.problems) ? body.problems : [];

  // 프론트엔드 callOpenAIDirect() 와 동일한 프롬프트 (원형 유지)
  const svcList = services.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt =
    `다음 회사 정보로 GEO 콘텐츠를 생성하세요.\n` +
    `산업: ${industry}\n고객: ${customer}\n서비스:\n${svcList}\n` +
    `문제: ${problems.slice(0, 5).join(', ')}\n\n` +
    `아래 JSON 형식으로만 응답:\n{\n` +
    `  "titles": [{"title":"","intent":"질문형","targetService":"","citation":"높음"}],\n` +
    `  "definitions": [{"service":"","anchor":"","differentiator":"","geoSentence":""}],\n` +
    `  "faqs": {"서비스명": [{"type":"정의","q":"","a":""}]}\n}\n` +
    `콘텐츠 제목 20개(70% 질문형), 서비스별 정의문장, 서비스별 FAQ 5개(정의/비용/적용방법/사례/효과).`;

  // Netlify 함수 한도(26초) 안쪽으로 24초 abort
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);

  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.85,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'GEO 전문가. 반드시 JSON만 응답. 한국어.' },
          { role: 'user',   content: prompt },
        ],
      }),
    });
    clearTimeout(timer);

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return { statusCode: 502, headers: JSON_HEADERS,
        body: JSON.stringify({ fallback: true, message: `OpenAI ${r.status}: ${errText.slice(0, 200)}` }) };
    }

    const json = await r.json();
    const content = json.choices?.[0]?.message?.content || '{}';

    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return { statusCode: 502, headers: JSON_HEADERS,
      body: JSON.stringify({ fallback: true, message: 'AI 응답 JSON 파싱 실패' }) }; }

    // mapAiResponse() 가 기대하는 { titles, definitions, faqs } 형태 그대로 반환
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(parsed) };
  } catch (e) {
    clearTimeout(timer);
    const msg = e.name === 'AbortError' ? '요청 타임아웃 (24초 초과)' : (e.message || '알 수 없는 오류');
    return { statusCode: 500, headers: JSON_HEADERS,
      body: JSON.stringify({ fallback: true, message: msg }) };
  }
};
