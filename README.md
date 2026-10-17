# مكاتب للإيجار في يعفور — Yaafour Office Rentals

إعلان مكتب للإيجار في يعفور (ريف دمشق) منشور بطريقة **headless** يقرؤها الـ AI agents
(ChatGPT وClaude وGrok وغيرها) مباشرة: MCP server، وكتالوج ARD، و`llms.txt`، وschema.org.

مصدر الحقيقة الوحيد هو [data/listings.json](data/listings.json). كل ما عداه يُولَّد منه.

## ماذا يُنشر

| المسار | لمن | ما هو |
|---|---|---|
| `/.well-known/ard.json` | registries وagents تدعم ARD | كتالوج [Agentic Resource Discovery](https://agenticresourcediscovery.org/spec/) v0.91 |
| `/.well-known/ai-catalog.json` | crawlers مكتوبة على المسودة السابقة | نفس الكتالوج على المسار القديم |
| `/mcp` | Claude وChatGPT وأي MCP client | MCP server (Streamable HTTP، بدون مصادقة، قراءة فقط) |
| `/mcp/server-card` | MCP clients وregistries | [MCP Server Card](https://modelcontextprotocol.io/seps/2127-mcp-server-cards) |
| `/api/offices` + `/openapi.json` | Custom GPT Actions وأي عميل REST | بحث بفلاتر: `location`، `max_price_usd`، `min_area_m2`، `max_area_m2`، `id` |
| `/llms.txt` | النماذج التي تقرأ الصفحات مباشرة | الإعلان كاملاً بصيغة Markdown |
| `/` | محركات البحث (ومنها يبحث ChatGPT وClaude وGrok) | صفحة واحدة مع JSON-LD من نوع `RealEstateListing` |
| `/robots.txt` | الكل | يسمح بالزحف، فيه `Sitemap` و`Agentmap` |

أدوات الـ MCP:
- `search_offices`: يقبل `location` (بالعربية أو الإنجليزية: يعفور، Yaafour، ريف دمشق، Damascus) و`max_price_usd` و`min_area_m2` و`max_area_m2`.
- `get_office_details`: يقبل `id`.

## النشر على Vercel (مرة واحدة)

1. افتح [vercel.com/new](https://vercel.com/new) واختر Import لهذا الريبو.
2. اترك الإعدادات كما هي، فملف `vercel.json` يحدد كل شيء.
3. عند ربط دومين خاص، أضف متغير البيئة `SITE_URL=https://your-domain` ثم أعد النشر.
   بدونه يُستخدم دومين Vercel الإنتاجي تلقائياً.

بعد النشر تحقق من هذه الروابط:
```
https://<domain>/.well-known/ard.json
https://<domain>/mcp/server-card
https://<domain>/llms.txt
```

## الربط مع المنصات

- **Claude**: Settings ← Connectors ← Add custom connector ← `https://<domain>/mcp`.
- **ChatGPT**: يمكن إضافته كـ MCP connector من Settings ← Connectors (يحتاج تفعيل Developer mode)،
  أو بإنشاء Custom GPT ← Actions ← Import from URL ← `https://<domain>/openapi.json`، ثم نشره في GPT Store.
- **Grok وغيره**: يصلون عبر بحث الويب، أي عبر الصفحة وJSON-LD و`llms.txt`.
  قدّم `sitemap.xml` في Google Search Console وBing Webmaster Tools، فـ ChatGPT Search يعتمد على Bing.

## إضافة مكتب أو تعديله

عدّل [data/listings.json](data/listings.json):
- لكل مكتب `id` فريد.
- ضع صوره في `public/images/`.
- اجعل `status` إما `available` أو `rented`.
- حدّث `updatedAt`.

حقل `price.period` يقبل `month` أو `year` أو `null`.

ثم ادفع التعديل، وVercel يعيد البناء تلقائياً.

## محلياً

```bash
npm test        # الاختبارات
npm run dev     # http://localhost:3000 و MCP على http://localhost:3000/mcp
```

جرّب الـ MCP:
```bash
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_offices","arguments":{"location":"يعفور"}}}' \
  http://localhost:3000/mcp
```

لا توجد dependencies، ويكفي Node 22 أو أحدث.

## أمان

كل ما هنا عام ومخصص للقراءة فقط. لا تضع في هذا الريبو أي token أو مفتاح API، ومن ذلك مفاتيح n8n.
سيرفر n8n MCP مخصص للإدارة الداخلية، وليس للـ agents العامة.
