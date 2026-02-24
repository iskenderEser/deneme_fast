// Vercel Serverless Function - Turkcell OTP SMS
// Path: /api/send-otp.js
// URL ENCODE DÜZELTMESI YAPILDI

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Sadece POST kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, code } = req.body;

    // Validasyon
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone ve code gerekli' });
    }

    // Environment variables
    const API_USER = process.env.ILETISIM_USER;
    const API_PASS = process.env.ILETISIM_PASS;
    const API_CUSTOMER = process.env.ILETISIM_CUSTOMER;
    const API_KEY = process.env.ILETISIM_API_KEY;
    const API_VENDOR = process.env.ILETISIM_VENDOR;
    const SERVICE_ID = process.env.ILETISIM_SERVICE_ID;

    console.log('📤 SMS gönderimi başlatılıyor:', phone);

    // ADIM 1: Token al (parametreler düz gönderilecek)
    const authUrl = new URL('https://live.iletisimmakinesi.com/api/UserGatewayWS/functions/authenticate');
    authUrl.searchParams.append('userName', API_USER);
    authUrl.searchParams.append('userPass', API_PASS);
    authUrl.searchParams.append('customerCode', API_CUSTOMER);
    authUrl.searchParams.append('apiKey', API_KEY);
    authUrl.searchParams.append('vendorCode', API_VENDOR);

    console.log('🔑 Token alınıyor...');
    const authResponse = await fetch(authUrl.toString());
    const authXml = await authResponse.text();

    console.log('📥 Auth Response:', authXml.substring(0, 500));

    // Token parse (basit regex)
    const tokenMatch = authXml.match(/<TOKEN_NO>(.*?)<\/TOKEN_NO>/);
    if (!tokenMatch) {
      console.error('❌ Token alınamadı:', authXml);
      return res.status(500).json({ 
        error: 'Token alınamadı', 
        response: authXml.substring(0, 1000) 
      });
    }
    const token = tokenMatch[1];
    console.log('✅ Token alındı:', token.substring(0, 20) + '...');

    // ADIM 2: Originator ID al (API'den çek)
    const origUrl = new URL('https://live.iletisimmakinesi.com/api/UserGatewayWS/functions/getOriginators');
    origUrl.searchParams.append('token', token);
    origUrl.searchParams.append('serviceId', SERVICE_ID);

    console.log('📋 Originator ID alınıyor...');
    console.log('🔗 Originator URL:', origUrl.toString());
    const origResponse = await fetch(origUrl.toString());
    const origXml = await origResponse.text();

    console.log('📥 Originator Response:', origXml.substring(0, 1000));

    // Originator ID parse (sadece id="..." yakala, service_id değil!)
    const origMatch = origXml.match(/<ORIGINATOR id="(\d+)"/);
    if (!origMatch) {
      console.error('❌ Originator ID alınamadı:', origXml);
      return res.status(500).json({ 
        error: 'Originator ID alınamadı', 
        response: origXml.substring(0, 1000) 
      });
    }
    const originatorId = origMatch[1];
    console.log('✅ Originator ID alındı:', originatorId);

    // ADIM 3: SMS gönder
    const messageText = `FAST CPR Dogrulama Kodunuz: ${code}\n\nKod 5 dakika gecerlidir. Kimseyle paylasmayiniz.`;
    
    const smsUrl = new URL('https://live.iletisimmakinesi.com/api/SingleShotWS/functions/sendSingleShotSMS');
    smsUrl.searchParams.append('token', token);
    smsUrl.searchParams.append('originatorId', originatorId);
    smsUrl.searchParams.append('phoneNumber', '90' + phone.substring(1)); // 0 kaldır, 90 ekle
    smsUrl.searchParams.append('messageText', messageText);

    console.log('📱 SMS gönderiliyor...');
    const smsResponse = await fetch(smsUrl.toString());
    const smsXml = await smsResponse.text();

    console.log('📥 SMS Response:', smsXml.substring(0, 500));

    // Status parse
    const statusMatch = smsXml.match(/<CODE>(.*?)<\/CODE>/);
    const statusCode = statusMatch ? statusMatch[1] : 'UNKNOWN';

    if (statusCode === '0') {
      console.log('✅ SMS başarıyla gönderildi!');
      return res.status(200).json({ 
        success: true, 
        message: 'SMS gönderildi',
        statusCode: statusCode
      });
    } else {
      console.error('❌ SMS hatası:', statusCode);
      return res.status(500).json({ 
        error: 'SMS gönderilemedi',
        statusCode: statusCode,
        response: smsXml.substring(0, 1000)
      });
    }

  } catch (error) {
    console.error('❌ Exception:', error);
    return res.status(500).json({ 
      error: 'Sunucu hatası',
      message: error.message 
    });
  }
}
