/**
 * PHARMACY SETTINGS: edit this one file to change name, logo, colours,
 * phone, WhatsApp, address and opening hours across the whole website.
 * Text that differs by language has an `en`, `ur` and `sd` version.
 */
export const site = {
  name: { en: "Nuskha Pharmacy", ur: "نسخہ فارمیسی", sd: "نسخو فارميسي" },

  // Put your logo in /public and change the file name here.
  logo: "/logo.svg",

  // Brand colours (hex). Indigo and madder red are taken from Sindhi ajrak.
  colors: {
    brand: "#1E3A6E", // main buttons, headings
    brandDeep: "#142850", // button hover / pressed
    madder: "#A8322B", // decorative ajrak band only (red is kept for danger alerts)
  },

  // Shown on screen exactly as written.
  phoneDisplay: "+92 300 0000000",
  // Used for the tap-to-call link: no spaces.
  phoneLink: "+923000000000",
  // WhatsApp number: country code + number, no "+", no spaces.
  whatsappNumber: "923000000000",
  whatsappMessage: {
    en: "Hello, I have a question about my prescription.",
    ur: "السلام علیکم، میرا اپنے نسخے کے بارے میں ایک سوال ہے۔",
    sd: "السلام عليڪم، منهنجو پنهنجي نسخي بابت هڪ سوال آهي.",
  },

  address: {
    en: "Shop 12, Main Road, Hyderabad, Sindh",
    ur: "دکان نمبر 12، مین روڈ، حیدرآباد، سندھ",
    sd: "دڪان نمبر 12، مين روڊ، حيدرآباد، سنڌ",
  },
  mapsUrl: "https://maps.google.com/?q=Hyderabad,Sindh",

  hours: [
    {
      days: { en: "Monday to Saturday", ur: "پیر تا ہفتہ", sd: "سومر کان ڇنڇر" },
      time: { en: "9:00 am to 11:00 pm", ur: "صبح 9 بجے سے رات 11 بجے تک", sd: "صبح 9 کان رات 11 وڳي تائين" },
    },
    {
      days: { en: "Sunday", ur: "اتوار", sd: "آچر" },
      time: { en: "2:00 pm to 10:00 pm", ur: "دوپہر 2 بجے سے رات 10 بجے تک", sd: "منجهند 2 کان رات 10 وڳي تائين" },
    },
  ],
} as const;
