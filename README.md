# Akıllı Tahmin Oyunu

[![CI](https://github.com/rose-omer/Akilli-Tahmin-Oyunu/actions/workflows/ci.yml/badge.svg)](https://github.com/rose-omer/Akilli-Tahmin-Oyunu/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](LICENSE)

Bu proje, EMAR Proje şirketindeki stajım sırasında, Staj Sorumlum Sayın **Mehmet Emre Doğan**'ın değerli yönlendirmeleri ve onaylarıyla geliştirildi. Kendisinin vizyonu ve geri bildirimleri, projenin temel yapısının ve işleyişinin şekillenmesinde belirleyici oldu.

Aklından bir şey tut; oyun en çok 30 evet/hayır sorusunda bulmaya çalışır. Her oyundan öğrenir: kaydedilen cevaplar bir sonraki oyunun soru seçimini ve tahminini değiştirir.

## Ekran görüntüleri

Görüntüler yerel bellekte tutulan soru ağacıyla alındı; veritabanı bağlı değil.

| | |
|---|---|
| ![Başlangıç](docs/ekran/1-giris.png)<br>Başlangıç | ![Soru ekranı](docs/ekran/2-sorgu.png)<br>Soru ekranı |
| ![Tahmin](docs/ekran/3-tahmin.png)<br>Tahmin | ![İstatistikler](docs/ekran/4-istatistikler.png)<br>İstatistikler |

## Kullanım

![Kullanım akışı](docs/ekran/kullanim.gif)

Oyuncu aklında bir şey tutar ve soruları evet, hayır ya da bilmiyorum diye cevaplar. Oyun en çok 30 soruda tahmin eder.

## Özellikler

- Evet / Hayır / Bilmiyorum cevapları; klavye kısayolları (E, H, B; G geri al).
- Soru ağacı ile başlar, ağaç bitince öğrenen motor devam eder.
- Öğrenen motor: Bayes güncellemesi + beklenen bilgi kazancı ile soru seçimi.
- Motor zayıf kalırsa Gemini, motorun ilk beş adayına bakarak tahmin eder (isteğe bağlı).
- Yanlış tahminde doğru cevap kaydedilir; motor o oyunun cevaplarını öğrenir.
- `/istatistik`: başarı oranı (haftalık), tahmin kaynağı payı, en çok bilinen varlıklar.
- Karanlık ve açık tema, mobil uyum, ekran okuyucu ve klavye desteği (WCAG AA).

## Nasıl öğreniyor?

1. **Sayaçlar.** Her varlık ve soru için üç sayaç tutulur: `evet`, `hayır`, `bilmiyorum` (`EntityAnswerStat`). Soru ağacındaki yollar ilk bilgiyi verir (ağırlık 10).
2. **Sonsal dağılım.** Her cevaptan sonra varlık olasılıkları Bayes kuralıyla güncellenir. Laplace düzeltmesi: `P(a | varlık, soru) = (sayaç[a] + 1) / (toplam + 3)`.
3. **Soru seçimi.** Sıradaki soru, beklenen bilgi kazancı en yüksek olandır:
   `IG(q) = H(p) − Σₐ P(a) · H(p | a)`, `P(a) = Σₑ p(e) · P(a | e, q)`.
4. **Tahmin.** En olası varlık 0,6'yı geçince ya da soru kalmayınca tahmin edilir. En iyi aday 0,35'in altındaysa ve `GEMINI_API_KEY` tanımlıysa Gemini'ye cevaplar ve ilk beş aday gider.
5. **Öğrenme.** Geri bildirimde doğru varlığın sayaçları artar. Ağaçta olmayan yeni bir varlık, en az `ENTITY_MIN_GAMES` (varsayılan 2) oyunda doğru cevap olarak geçmeden motoru etkilemez. Yeni varlık eklenince Gemini ayırt edici bir soru önerir; soru yönetici onayı (`Question.approved`) olmadan havuza girmez. Onay `/yonetim` sayfasında yapılır (`ADMIN_TOKEN` parolasıyla; değişken boşsa sayfa 404 döner).

Kayıtlı oyun sayısı `ENGINE_MIN_GAMES` değerini geçince oyunlar baştan motorla başlar.

### Veri modeli

```
Game ──< GameQuestion            (oyun ve sorulan sorular)
Game >── Entity ──< EntityAnswerStat >── Question
RateLimit (ipHash, windowStart, count)   (ham IP saklanmaz)
```

### Güvenlik

- İstemci yalnız `{ soruKimliği, cevap }` dizisini gönderir; serbest metin kabul edilmez. Gemini istemi sunucuda, ağaçtaki soru metinlerinden kurulur.
- Sunucu her tahmini HMAC jetonuyla imzalar (mod, adımlar, ad, kaynak, zaman). Geri bildirim yalnız geçerli ve bir saatten yeni jetonla kabul edilir; istemci uydurma bir adı "doğru" diye kaydedemez.
- Bütün girdiler `zod` ile doğrulanır. Server Action'lar da herkese açık POST uç noktasıdır.
- Hız sınırı: IP özeti başına dakikada 30 istek (`RATE_LIMIT_PER_MINUTE`). IP, tuzlu SHA-256 özeti olarak `RateLimit` tablosunda kısa süre tutulur; eski pencereler ara sıra silinir.
- IP kaynağı: Vercel'de platformun yazdığı `x-vercel-forwarded-for` / `x-real-ip`. Vercel dışında `X-Forwarded-For` zincirinin, güvenilir proxy'lerin eklediği kısmı (`TRUSTED_PROXY_HOPS`, varsayılan 1: son öğe). Uygulama proxy'siz doğrudan açılırsa bu başlığı istemci yazar; hız sınırı aşılabilir.
- İstemciye yalnız sabit hata türü ve istek kimliği döner; ayrıntı sunucu logunda kalır.

## Teknoloji

| Bileşen                         | Sürüm                           |
| ------------------------------- | ------------------------------- |
| Next.js (App Router, Turbopack) | 16.4.6                          |
| React                           | 19.3.1                          |
| TypeScript                      | 6.0.3                           |
| Tailwind CSS                    | 4.3.5                           |
| Prisma + Neon adapter           | 7.10.1                          |
| @google/genai                   | 3.6.1 (`gemini-3.5-flash-lite`) |
| zod                             | 4.6.7                           |
| Vitest / Playwright             | 5.1.1 / 1.65.1                  |

Node 22.12 ya da üstü gerekir; CI Node 24 kullanır.

## Kurulum

```bash
git clone https://github.com/rose-omer/Akilli-Tahmin-Oyunu.git
cd Akilli-Tahmin-Oyunu
npm ci
cp .env.example .env        # değerleri doldur
npx prisma migrate deploy   # DATABASE_URL_UNPOOLED ile
npm run dev
```

Veritabanı ve Gemini isteğe bağlıdır:

- `DATABASE_URL` boşsa oyunlar süreç belleğinde tutulur (sunucu kapanınca silinir).
- `GEMINI_API_KEY` boşsa tahminleri soru ağacı ve öğrenen motor yapar.

### Ortam değişkenleri

| Değişken                | Açıklama                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Neon pooler adresi (uygulama).                                                                         |
| `DATABASE_URL_UNPOOLED` | Neon doğrudan adres (Prisma CLI, migration).                                                           |
| `SHADOW_DATABASE_URL`   | Yalnız `npm run db:diff` için boş bir Postgres.                                                        |
| `GEMINI_API_KEY`        | Google AI Studio anahtarı.                                                                             |
| `GEMINI_MODEL`          | Varsayılan `gemini-3.5-flash-lite`.                                                                    |
| `RATE_LIMIT_PER_MINUTE` | Varsayılan 30.                                                                                         |
| `IP_HASH_SALT`          | IP özeti tuzu ve tahmin jetonu anahtarı. `DATABASE_URL` ya da Vercel varsa zorunlu, en az 16 karakter. |
| `ENGINE_MIN_GAMES`      | Motorun baştan yönettiği eşik; varsayılan 25.                                                          |
| `ENTITY_MIN_GAMES`      | Yeni varlığın motora girmesi için gereken oyun; varsayılan 2.                                          |
| `TRUSTED_PROXY_HOPS`    | Vercel dışında `X-Forwarded-For`'a adres ekleyen proxy sayısı; varsayılan 1.                           |
| `ADMIN_TOKEN`           | `/yonetim` soru onayı parolası, en az 16 karakter. Boşsa sayfa kapalı.                                 |
| `TEST_DATABASE_URL`     | Yalnız entegrasyon testi: migration uygulanmış boş Postgres.                                           |

## Komutlar

| Komut                         | İş                                                                |
| ----------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                 | Geliştirme sunucusu                                               |
| `npm run build` / `npm start` | Üretim derlemesi ve sunucu                                        |
| `npm run lint`                | ESLint 10 (flat config, `eslint-config-next`)                     |
| `npm run typecheck`           | Rota tipleri + `tsc --noEmit`                                     |
| `npm test`                    | Birim testleri; `TEST_DATABASE_URL` varsa Postgres entegrasyonu   |
| `npm run test:e2e`            | Playwright + axe; önce `npm run build`                            |
| `npm run db:migrate`          | `prisma migrate deploy`                                           |
| `npm run db:diff`             | Migration ile şema sapması (`--exit-code`); `SHADOW_DATABASE_URL` |

### Şema sapması ve entegrasyon testi

- `npm run db:diff` migration'ları geçici bir veritabanında kurar; bu yüzden `SHADOW_DATABASE_URL` (boş bir Postgres) ister. Yoksa Prisma "You must set datasource.shadowDatabaseUrl" hatası verir.
- `tests/integration/` Prisma deposunu gerçek Postgres'e karşı dener (`@prisma/adapter-pg`). `TEST_DATABASE_URL` yoksa atlanır. Yerelde:

```bash
export DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/tahmin
npx prisma migrate deploy
TEST_DATABASE_URL=$DATABASE_URL_UNPOOLED npm test
```

- CI ikisini de `postgres:17` servisiyle koşar.

## Dağıtım (Vercel + Neon)

1. Vercel'de Neon entegrasyonunu ekle; `DATABASE_URL` ve `DATABASE_URL_UNPOOLED` gelir.
2. `GEMINI_API_KEY`, `GEMINI_MODEL`, `IP_HASH_SALT` (uzun rastgele değer) değişkenlerini ekle.
3. Dağıtımdan önce `npx prisma migrate deploy` çalıştır.

## Proje yapısı

```
app/                 sayfalar ve Server Action'lar (actions.ts)
app/istatistik/      istatistik sayfası (Server Component)
app/yonetim/         Gemini soru önerilerinin onay kuyruğu
components/game/     oyun ekranları ve durum makinesi
data/                soru ağacı (question-tree.json)
lib/engine/          öğrenen motor: posterior.ts, infoGain.ts, knowledge.ts
lib/game/            sunucu tarafı oyun servisi
lib/store/           Prisma ve bellek depoları
prisma/              şema ve migration'lar
tests/, e2e/         Vitest ve Playwright testleri
```

## Lisans

MIT. Ayrıntı: [LICENSE](LICENSE).
