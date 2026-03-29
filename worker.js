// Cloudflare Worker - CORS 代理 + KV 存储
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const MSG_KEY = 'zz_messages';

    try {
      // GET: 读取消息
      if (request.method === 'GET') {
        const data = await env.ZZ_STORE.get(MSG_KEY, 'json');
        return new Response(JSON.stringify(data || { from: '', to: '', content: '', ts: 0, isImage: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // PUT/POST: 写入消息
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        await env.ZZ_STORE.put(MSG_KEY, JSON.stringify(body));
        return new Response(JSON.stringify(body), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'method' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
