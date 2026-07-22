/**
 * Staris Studio - Educational Games Landing Page + Order System
 * Backend: Google Apps Script (container-bound to a Google Sheet)
 */

var SHEET_NAME = 'Orders';
var HEADERS = ['Timestamp', 'Order Ref', 'Nama', 'Telefon', 'Email', 'Pakej', 'Jumlah (RM)', 'Kaedah Bayaran', 'Status', 'Order ID', 'Tarikh Selesai'];

var STATUS_PENDING = 'Menunggu Semakan Pembayaran';
var STATUS_DONE = 'Selesai';

var PACKAGES = [
  { id: 'momo', name: "Misi Momo (Math Tahun 1)", price: 25 },
  { id: 'kiki', name: "Kiki's Mission (English Tahun 1)", price: 25 },
  { id: 'atom', name: "Makmal Dr Atom (Sains Tahun 1)", price: 25 },
  { id: 'bundle', name: "Semua Sekali (Bundle 3 Pakej)", price: 50 }
];

// Update after the GitHub repo is created, e.g. https://cdn.jsdelivr.net/gh/USERNAME/REPO@main/assets
var ASSET_BASE_URL = 'https://cdn.jsdelivr.net/gh/PLACEHOLDER/PLACEHOLDER@main/assets';

var PAYMENT_INFO = {
  bankName: 'Maybank',
  accountNumber: '5516 0505 0095',
  accountName: 'Staris Studio',
  qrImageUrl: 'https://i.imgur.com/JtoLzSa.jpeg',
  whatsapp: '60104545949'
};

/* ---------------- Web app routing ---------------- */

function doGet(e) {
  ensureSetup();
  var page = e && e.parameter && e.parameter.page;
  var template;
  if (page === 'admin') {
    template = HtmlService.createTemplateFromFile('Admin');
  } else {
    template = HtmlService.createTemplateFromFile('Index');
    template.packages = PACKAGES;
    template.paymentInfo = PAYMENT_INFO;
    template.assetBase = ASSET_BASE_URL;
  }
  return template.evaluate()
    .setTitle('Staris Studio - Educational Games')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ---------------- Setup ---------------- */

function ensureSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) {
    props.setProperty('ADMIN_PASSWORD', 'ubah-password-ini');
  }
  if (!props.getProperty('ADMIN_EMAIL')) {
    props.setProperty('ADMIN_EMAIL', Session.getEffectiveUser().getEmail());
  }
}

/**
 * Run this once manually from the Apps Script editor to configure the
 * admin password and notification email.
 */
function setup(adminPassword, adminEmail) {
  ensureSetup();
  var props = PropertiesService.getScriptProperties();
  if (adminPassword) props.setProperty('ADMIN_PASSWORD', adminPassword);
  if (adminEmail) props.setProperty('ADMIN_EMAIL', adminEmail);
}

/* ---------------- Client-facing: submit order ---------------- */

function submitOrder(form) {
  ensureSetup();

  var name = (form.name || '').toString().trim();
  var phone = (form.phone || '').toString().trim();
  var email = (form.email || '').toString().trim();
  var packageIds = form.packages || [];
  var paymentMethod = (form.paymentMethod || '').toString().trim();

  if (!name || !phone || !email || !packageIds.length) {
    throw new Error('Sila lengkapkan semua maklumat dan pilih sekurang-kurangnya satu pakej.');
  }

  var selected = PACKAGES.filter(function (p) { return packageIds.indexOf(p.id) !== -1; });
  var packageNames = selected.map(function (p) { return p.name; }).join(', ');
  var total = selected.reduce(function (sum, p) { return sum + p.price; }, 0);

  var orderRef = generateOrderRef();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  sheet.appendRow([
    new Date(),
    orderRef,
    name,
    phone,
    email,
    packageNames,
    total,
    paymentMethod,
    STATUS_PENDING,
    '',
    ''
  ]);

  sendClientOrderEmail(email, name, orderRef, packageNames, total);
  sendAdminNewOrderEmail(orderRef, name, phone, email, packageNames, total);

  return {
    orderRef: orderRef,
    amount: total,
    packages: packageNames,
    paymentInfo: PAYMENT_INFO
  };
}

function generateOrderRef() {
  var stamp = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyMMddHHmmss');
  var rand = Math.floor(100 + Math.random() * 900);
  return 'SS-' + stamp + '-' + rand;
}

/* ---------------- Admin dashboard ---------------- */

function checkAdminPassword_(password) {
  var props = PropertiesService.getScriptProperties();
  return password && password === props.getProperty('ADMIN_PASSWORD');
}

function adminGetOrders(password) {
  if (!checkAdminPassword_(password)) {
    throw new Error('Password admin salah.');
  }
  ensureSetup();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var orders = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    orders.push({
      rowNumber: i + 2,
      timestamp: row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Kuala_Lumpur', 'dd/MM/yyyy HH:mm') : '',
      orderRef: row[1],
      name: row[2],
      phone: row[3],
      email: row[4],
      packages: row[5],
      amount: row[6],
      paymentMethod: row[7],
      status: row[8],
      orderId: row[9],
      completedAt: row[10] ? Utilities.formatDate(new Date(row[10]), 'Asia/Kuala_Lumpur', 'dd/MM/yyyy HH:mm') : ''
    });
  }
  orders.reverse();
  return orders;
}

function adminApproveOrder(password, rowNumber) {
  if (!checkAdminPassword_(password)) {
    throw new Error('Password admin salah.');
  }
  ensureSetup();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var statusCol = 9;
  var orderIdCol = 10;
  var completedCol = 11;

  var existingOrderId = sheet.getRange(rowNumber, orderIdCol).getValue();
  var orderId = existingOrderId || generateUniqueOrderId_(sheet);

  sheet.getRange(rowNumber, statusCol).setValue(STATUS_DONE);
  sheet.getRange(rowNumber, orderIdCol).setValue(orderId);
  sheet.getRange(rowNumber, completedCol).setValue(new Date());

  var name = sheet.getRange(rowNumber, 3).getValue();
  var email = sheet.getRange(rowNumber, 5).getValue();
  var packages = sheet.getRange(rowNumber, 6).getValue();
  var phone = sheet.getRange(rowNumber, 4).getValue();

  sendClientOrderIdEmail(email, name, orderId, packages);

  return {
    orderId: orderId,
    phone: phone,
    name: name
  };
}

function generateUniqueOrderId_(sheet) {
  var lastRow = sheet.getLastRow();
  var existingIds = [];
  if (lastRow >= 2) {
    existingIds = sheet.getRange(2, 10, lastRow - 1, 1).getValues().map(function (r) { return r[0]; });
  }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id;
  do {
    id = 'ORD-';
    for (var i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.indexOf(id) !== -1);
  return id;
}

/* ---------------- Emails ---------------- */

function sendClientOrderEmail(email, name, orderRef, packageNames, total) {
  var subject = 'Staris Studio - Order Diterima (' + orderRef + ')';
  var body = ''
    + '<p>Hai ' + escapeHtml_(name) + ',</p>'
    + '<p>Terima kasih! Order anda telah diterima:</p>'
    + '<p><b>No. Rujukan:</b> ' + escapeHtml_(orderRef) + '<br>'
    + '<b>Pakej:</b> ' + escapeHtml_(packageNames) + '<br>'
    + '<b>Jumlah:</b> RM' + total + '</p>'
    + '<p>Sila buat pembayaran melalui QR atau pindahan manual seperti yang dipaparkan di laman web, '
    + 'dan hantar resit/screenshot pembayaran ke WhatsApp admin: '
    + '<a href="https://wa.me/' + PAYMENT_INFO.whatsapp + '">wa.me/' + PAYMENT_INFO.whatsapp + '</a>.</p>'
    + '<p>Order ID rasmi akan dihantar ke email ini sebaik sahaja pembayaran disahkan oleh admin.</p>'
    + '<p>Terima kasih kerana memilih Staris Studio! 🎉</p>';
  MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
}

function sendAdminNewOrderEmail(orderRef, name, phone, email, packageNames, total) {
  var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!adminEmail) return;
  var subject = 'Order Baru Masuk - ' + orderRef;
  var body = ''
    + '<p>Order baru diterima:</p>'
    + '<p><b>Rujukan:</b> ' + escapeHtml_(orderRef) + '<br>'
    + '<b>Nama:</b> ' + escapeHtml_(name) + '<br>'
    + '<b>Telefon:</b> ' + escapeHtml_(phone) + '<br>'
    + '<b>Email:</b> ' + escapeHtml_(email) + '<br>'
    + '<b>Pakej:</b> ' + escapeHtml_(packageNames) + '<br>'
    + '<b>Jumlah:</b> RM' + total + '</p>'
    + '<p>Sila semak WhatsApp untuk resit pembayaran, kemudian approve order di admin dashboard.</p>';
  MailApp.sendEmail({ to: adminEmail, subject: subject, htmlBody: body });
}

function sendClientOrderIdEmail(email, name, orderId, packageNames) {
  var subject = 'Staris Studio - Order ID Anda: ' + orderId;
  var body = ''
    + '<p>Hai ' + escapeHtml_(name) + ',</p>'
    + '<p>Pembayaran anda telah disahkan. Berikut adalah Order ID untuk akses pakej: <b>' + escapeHtml_(packageNames) + '</b></p>'
    + '<h2 style="color:#2b6cb0;">' + escapeHtml_(orderId) + '</h2>'
    + '<p>Sila simpan Order ID ini dan gunakan untuk akses produk yang telah dibeli.</p>'
    + '<p>Terima kasih dan selamat belajar! 🎉</p>';
  MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
