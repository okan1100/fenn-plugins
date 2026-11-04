# Fenn Plugin Pack · Fenn Eklenti Paketi

Fun and useful tiles for [Fenn](https://fenn.click), the floating notch for
Windows. Every plugin speaks **English and Turkish** — the language follows
your system on first run and a globe button on each page switches it.
Fenn'in cam paneli için eğlenceli ve kullanışlı döşemeler. Her eklenti
**İngilizce ve Türkçe** çalışır — dil ilk açılışta sistem dilinize göre seçilir,
her sayfadaki dünya düğmesiyle değiştirilir.

## Plugins · Eklentiler

| Plugin | Tile | What it does · Ne yapar |
|---|---|---|
| `snake` · Yılan | large | The classic snake game: keyboard (arrows/WASD) or on-screen pad, speed ramps up, best score saved. Klâsik yılan oyunu: klavye veya ekran tuşlarıyla, hızlanır, rekor kaydedilir. |
| `tetris` | large | Falling blocks: rotate, drop, line clears, levels, next-piece preview, best score. Düşen bloklar: döndürme, satır silme, seviyeler, sonraki parça, rekor. |
| `dice` · Zar | small | Dice roller (d4–d20, up to 5 dice) and a coin flip, with roll history. Zar atıcı (d4–d20, 5'e kadar) ve madeni para; atış geçmişi. |
| `memory` · Hafıza | large | 4×4 icon matching game: moves, timer, best-move record. 4×4 ikon eşleştirme: hamle, süre, rekor. |
| `countdown` · Gün Sayacı | wide | Days left to your dates (birthdays count yearly). Tile shows the nearest one. Günlerinize kalan gün (yıllık tekrarlı doğum günleri). Tile en yakını gösterir. |
| `unit-converter` · Birim Çevirici | wide | Length, mass, temperature, area, volume, speed. Live two-way conversion. Uzunluk, kütle, sıcaklık, alan, hacim, hız. |
| `password-gen` · Parola Üretici | wide | Strong random passwords (crypto RNG), strength ring, one-click copy. Güçlü rastgele parolalar, güç halkası, tek tıkla kopyala. |

## Install · Kurulum

Copy each plugin folder into `%APPDATA%\Fenn\plugins\` (already done on this
machine), or point `FENN_PLUGIN_PATH` at this folder's parent. With
**Settings → Plugin dev mode** on, Fenn picks up changes in about a second.
Her eklenti klasörünü `%APPDATA%\Fenn\plugins\` içine kopyalayın (bu makinede
yapıldı). **Ayarlar → Eklenti geliştirme modu** açıkken Fenn değişiklikleri
bir saniyede alır.

**Requirement · Gereksinim:** Node.js 18+ on PATH (`run = ["node", "main.js"]`).

## Notes · Notlar

- No account, no network, no telemetry. State (language, scores, dates) lives
  in `%APPDATA%\Fenn\plugin-data\<id>`. Hesap, ağ, telemetri yok.
- Icons come from Fenn's Phosphor set; colors follow your theme and accent.
  Renkler temanıza ve vurgu renginize uyar.
- Validate after any change:
  `python ..\fenn-plugin\scripts\check_plugin.py <folder>`

## Publish · Paylaşım

Each folder is a self-contained repo: push it public on GitHub, then submit
the link on Fenn's *Submit a plugin* page. Keep `version` bumped on updates.
Her klasör tek başına bir depodur: GitHub'da yayımlayıp Fenn'in *Submit a
plugin* sayfasından bağlantıyı gönderin.
