# Yayınla — Adım Adım Kılavuz (Railway + ikas Partner Paneli)

Bu dosya uygulamayı internete yükleyip ikas App Store'a göndermek için
yapman gereken her şeyi anlatır. Teknik bilgi gerekmez; sırayla uygula.

Önemli kavram: **Alan adı** = uygulamanın internetteki adresi. Bunu sen
bulmazsın; Railway sana bir adres verir. Örnek:
`https://nostok-production.up.railway.app` — kılavuz boyunca buna **`<ADRES>`**
diyeceğiz.

---

## Bölüm 1 — İki hesap aç (yaklaşık 10 dakika)

### 1.1 GitHub hesabı (kodun saklanacağı yer)
1. https://github.com adresine git → **Sign up** → e-posta, şifre, kullanıcı adı.
2. Üstteki **+** işaretine tıkla → **New repository**.
3. Repository name: `nostok` · **Private** seç · **Create repository**.
4. GitHub sana bir sayfa gösterecek; "…or push an existing repository" başlığı
   altındaki 3 komutu BANA GÖNDER — kodu yüklemeyi ben hazırlayacağım.

### 1.2 Railway hesabı (uygulamanın barınacağı yer)
1. https://railway.com adresine git → **Login** → **Login with GitHub** (az önce
   açtığın hesapla giriş yapar).
2. Ücretsiz planı seç. Kredi kartı istenirse "Free plan" seçeneğini kullan.

---

## Bölüm 2 — Uygulamayı Railway'e yükleme

1. Railway panosunda **New Project** → **Deploy from GitHub repo** → `nostok`
   reposunu seç.
2. Uygulama otomatik derlenmeye başlar. Derleme **hata verirse** ekran
   görüntüsünü at — birlikte düzeltiriz.
3. Sağdaki **Volumes** bölümünde: **Mount Volume** → Mount path: `/data`
   (veritabanının kalıcı olarak duracağı yer).
4. **Variables** sekmesine şu değerleri ekle (değerleri Bölüm 3'te bulacaksın):

   | Değişken | Değer |
   |---|---|
   | `NEXT_PUBLIC_DEPLOY_URL` | `https://<ADRES>` (Bölüm 2.5'te belli olur) |
   | `NEXT_PUBLIC_GRAPH_API_URL` | `https://api.myikas.com/api/v2/admin/graphql` |
   | `NEXT_PUBLIC_ADMIN_URL` | `https://{storeName}.myikas.com/admin` |
   | `NEXT_PUBLIC_CLIENT_ID` | Partner panelinden (Bölüm 3.1) |
   | `CLIENT_SECRET` | Partner panelinden (Bölüm 3.1) |
   | `SECRET_COOKIE_PASSWORD` | 40+ karakterlik rastgele bir metin (Bölüm 3.2) |
   | `DATABASE_URL` | `file:/data/app.db` |

5. Servisin **Settings** → **Networking** → **Generate Domain** butonuna bas.
   Railway sana `https://<ADRES>` biçiminde bir adres verir. Bu adresi
   `NEXT_PUBLIC_DEPLOY_URL` değerine yaz (sonunda `/` OLMAYACAK).
6. Birkaç dakika bekle; tarayıcıda `https://<ADRES>` açılırsa uygulama
   yayında demektir.

---

## Bölüm 3 — Değerlerin kaynakları

### 3.1 client_id ve client_secret
ikas **Partner paneli** (partners.ikas.com) → sol menü → **Konfigürasyon** →
*Uygulama Kimlik Bilgileri*:
- `NEXT_PUBLIC_CLIENT_ID` ← **client_id** kutusundaki değer
- `CLIENT_SECRET` ← **client_secret** kutusundaki değer (gizliyse "göster" ikonu)

### 3.2 SECRET_COOKIE_PASSWORD
Bu bir "gizli oturum anahtarı" — ikas'tan gelmez, sen uydurursun. En kolay
yöntem: https://1password.com/password-generator adresinde 40 karakterlik bir
şifre üret, kopyala. (Bir daha değiştirmene gerek yok.)

### 3.3 Partner paneline gireceğin adresler
Railway sana `<ADRES>`'i verdikten sonra Partner panelinde şunları gir:

| Paneldeki alan | Değer |
|---|---|
| Uygulama Adresi (Kurulum Adresi) | `https://<ADRES>/` |
| Yönlendirme Adresi | `https://<ADRES>/api/oauth/callback/ikas` |
| Bildirim Adresi (Webhook Adresi) | `https://<ADRES>/api/webhooks/ikas` |

### 3.4 Partner paneli › Uygulama Yetkileri
"Tüm Yetkiler"i KAPAT, yalnız şunları işaretle:
- Ürünler: Görüntüle + Düzenle
- Envanter: Görüntüle + Düzenle
- Kampanyalar: Düzenle
- Mağaza: Düzenle

(Siparişler ve Müşteriler kapalı kalacak.)

---

## Bölüm 4 — Test ve gönderme

1. İkas panelinden (geliştirme mağazalarından biri) uygulamayı aç —
   OAuth kurulumu sorunsuz tamamlanmalı, dashboard görünmeli.
2. Mağaza vitrinine gidip duyuru popup'ını dene (Duyuru sekmesi → Yayınla).
3. İkas panelinden uygulamayı kaldır → vitrindeki script kaybolmalı
   (Bildirim Adresi sayesinde otomatik temizlenir).
4. Partner paneli → **Yayınla** → listeleme bilgileri (ad, logo, açıklama,
   görseller) → **Herkese Açık** olarak gönder.

Not: `npx ikas dev` ile lokal geliştirme yapmaya devam edebilirsin; lokalde
veritabanı `prisma/dev.db`'de kalır, Railway kendi `/data/app.db` dosyasını
kullanır. İkisi birbirine karışmaz.
