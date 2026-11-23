# Chatbot — Supabase, GitHub və Vercel

Bu qovluq statik sayt kimi yayımlanır. `index.html` istifadəçi çatıdır, `admin.html` qrup sahibinin idarəetmə panelidir. Əlavə Python serverinə (`main.py`) ehtiyac yoxdur: giriş, məlumat bazası, real vaxt və fayl saxlanması Supabase tərəfindən təmin edilir.

## 1. Supabase bağlantısı

1. Supabase-də yeni layihə yarat.
2. Supabase **SQL Editor**-də `supabase/schema.sql` faylının məzmununu bir dəfə işə sal.
3. **Project Settings → API** bölməsindən Project URL və public anon/publishable açarını götür. `service_role` açarını HTML-ə və ya brauzer koduna yazma.
4. `config.js` faylında `YOUR_PROJECT` və `YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY` yerlərini öz URL və public açarınla əvəz et.
5. **Authentication → URL Configuration** bölməsində Vercel saytının URL-ini Site URL və Redirect URLs siyahısına əlavə et.

SQL sxemi hesablar, qruplar, üzvlük, real vaxt mesajları və private PDF bucket yaradır. RLS qaydaları ilə yalnız üzvlər yazışmaları oxuyur; qrup sahibi dəvət kodlarını və PDF-ləri idarə edir.

## 2. GitHub

Faylları repository-nin əsas qovluğuna yerləşdir: `index.html`, `admin.html`, `styles.css`, `app.js`, `admin.js`, `supabase.js`, `config.js` və `supabase/schema.sql`. HTML və JS faylları eyni səviyyədə qalmalıdır.

Public anon açarı brauzer üçün nəzərdə tutulub və gizli deyil; təhlükəsizlik RLS qaydaları ilə təmin edilir. `service_role` secret açarını heç vaxt repository-yə yükləmə.

## 3. Vercel

1. Vercel-də GitHub repository-ni **Import** et.
2. **Framework Preset: Other** seç. Build command boş qalsın; HTML/CSS/JS statik saytı üçün build addımı lazım deyil. Vercel faylları repository-nin əsas qovluğundan yayımlayır.
3. Deploy et. Ana səhifə `/`, admin səhifəsi `/admin.html` ünvanında olacaq.
4. GitHub-a yeni commit gələndə Vercel avtomatik yenidən deploy edir.

## Təhlükəsizlik qeydi

Mesajlar TLS bağlantısı və Supabase giriş qaydaları ilə qorunur; ucdan-uca şifrələmə yoxdur. PDF yükləmə limiti 10 MB-dır.
