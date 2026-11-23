# Chatbot — FastAPI, Supabase və Vercel

## Repo quruluşu

Bu faylları GitHub repository-nin əsas qovluğuna yerləşdir:

- `main.py` — Vercel-in FastAPI giriş nöqtəsi; `/` üçün çat, `/admin.html` üçün admin səhifəsi verir.
- `requirements.txt` — FastAPI və yerli işlətmək üçün Uvicorn asılılıqları.
- `vercel.json` — Vercel Framework Preset-i FastAPI edir və HTML fayllarını funksiyaya əlavə edir.
- `index.html`, `admin.html` — müvafiq çat və admin səhifələri.
- `supabase/schema.sql` — Supabase cədvəlləri, giriş qaydaları, RPC funksiyaları və PDF storage.

`main.py` Vercel-in tanıdığı standart giriş faylıdır və içində `app = FastAPI(...)` var. Buna görə `tool.vercel.entrypoint` ayrıca təyin etmək lazım deyil.

## Supabase quraşdırması

1. Supabase-də layihə yarat.
2. `supabase/schema.sql` faylını Supabase **SQL Editor**-də bir dəfə işə sal.
3. Supabase Project Settings → API bölməsindən Project URL və public anon/publishable key-i götür.
4. `index.html` və `admin.html` daxilindəki `SUPABASE_URL` və `SUPABASE_ANON_KEY` nümunə dəyərlərini dəyiş.
5. Supabase Auth URL Configuration-da Vercel saytının domain-ini Site URL və Redirect URLs-a əlavə et.

`service_role` secret açarını heç vaxt HTML/JavaScript-ə yerləşdirmə. Məlumatlara girişi SQL-dəki RLS qaydaları məhdudlaşdırır.

## Vercel-də yayımlamaq

GitHub repository-ni Vercel-ə bağla və Root Directory-ni repository-nin əsas qovluğu seç. `Framework Preset` `FastAPI` olmalıdır. Build command və output directory təyin etməyə ehtiyac yoxdur. `main.py`, `requirements.txt`, `vercel.json`, HTML faylları və `supabase/` qovluğunun hamısının repository-nin əsas qovluğunda olduğunu yoxla, sonra yenidən deploy et.

Vercel алдааны шалгалт: `https://ТАНЫ-ДОМЕН/api/health` нь `{"status":"ok","service":"Chatbot"}` буцаана.

## Lokal işə salmaq

```sh
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

Lokal saytın əsas ünvanı `http://127.0.0.1:8000`, admin panelin ünvanı `http://127.0.0.1:8000/admin.html` olacaq.

## Хамрах хүрээ ба хамгаалалт

Email/пароль бүртгэл, бүлэг үүсгэх ба invite code-оор нэгдэх, бодит цагийн мессеж, админы код солих/бүлэг устгах болон private PDF upload/delete нь Supabase schema-тай холбогдоно. Мессежүүд TLS ба RLS хамгаалалттай; end-to-end encryption хийгдээгүй.
