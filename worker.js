// Cloudflare Worker - CORS 代理 + 消息存储
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 消息存储（内存，重启丢失，适合测试）
    if (!globalThis.msgStore) {
      globalThis.msgStore = { from: '', to: '', content: '', ts: 0, isImage: false };
    }

    try {
      // GET: 读取消息
      if (request.method === 'GET') {
        return new Response(JSON.stringify(globalThis.msgStore), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // PUT/POST: 写入消息
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        globalThis.msgStore = body;
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
