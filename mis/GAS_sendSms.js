// ============================================================
//  UJUMBE SMS — GOOGLE APPS SCRIPT
//  Paste this entire file into your Code.gs (or a new .gs tab)
//  Then redeploy as a NEW VERSION of your Web App.
// ============================================================

var UJUMBE_API_KEY = 'Yjk0NTAyZjc5ZWY0NDRlY2I1MWU0YTRmZWQwNjk5';
var UJUMBE_EMAIL   = 'danyelthuo@gmail.com'; // ← change this
var UJUMBE_SENDER  = 'JOSHCABINFO';
var UJUMBE_URL     = 'https://ujumbesms.co.ke/api/messaging';

// ============================================================
//  REPLACE YOUR ENTIRE doPost() WITH THIS ONE
//  (or merge the sendSms case into your existing switch block)
// ============================================================

function doPost(e) {
  var action = '';
  var data   = {};

  try {
    action = e.parameter.action || '';
    data   = JSON.parse(e.parameter.data || '{}');
  } catch (err) {
    return jsonOut({ success: false, error: 'Bad request: ' + err.toString() });
  }

  switch (action) {

    // ── SMS ─────────────────────────────────────────────────
    case 'sendSms':
      return jsonOut(sendSmsViaUjumbe(data.phones, data.message));

    // ── YOUR EXISTING CASES BELOW (leave them untouched) ────
    // case 'addStudent':     return jsonOut(addStudent(data));
    // case 'updateStudent':  return jsonOut(updateStudent(data));
    // case 'recordPayment':  return jsonOut(recordPayment(data));
    // case 'addCourse':      return jsonOut(addCourse(data));
    // case 'deleteCourse':   return jsonOut(deleteCourse(data));
    // ────────────────────────────────────────────────────────

    default:
      return jsonOut({ success: false, error: 'Unknown action: ' + action });
  }
}

// ============================================================
//  SEND SMS VIA UJUMBE REST API
//  phones  : array of strings in 254XXXXXXXXX format
//  message : SMS body text
// ============================================================

function sendSmsViaUjumbe(phones, message) {
  if (!phones || !phones.length || !message) {
    return { success: false, error: 'Missing phones or message' };
  }

  // Normalise numbers: 07XX → 2547XX, strip spaces
  var normalised = phones.map(function (p) {
    return String(p).replace(/\s+/g, '').replace(/^\+/, '').replace(/^0/, '254');
  }).filter(function (p) { return p.length >= 9; });

  if (!normalised.length) {
    return { success: false, error: 'No valid phone numbers provided' };
  }

  // Build payload — one message_bag per number for personalised messages
  var bagArray = normalised.map(function (num) {
    return {
      message_bag: {
        numbers:   num,
        message:   message,
        sender:    UJUMBE_SENDER,
        send_time: ''          // empty = send immediately
      }
    };
  });

  var payload = JSON.stringify({ data: bagArray });

  var options = {
    method:             'post',
    contentType:        'application/json',
    headers: {
      'X-Authorization': UJUMBE_API_KEY,
      'Email':           UJUMBE_EMAIL
    },
    payload:            payload,
    muteHttpExceptions: true
  };

  try {
    var response     = UrlFetchApp.fetch(UJUMBE_URL, options);
    var code         = response.getResponseCode();
    var body         = response.getContentText();
    var json         = {};

    try { json = JSON.parse(body); } catch (e) { json = {}; }

    Logger.log('UjumbeSMS [' + code + ']: ' + body);

    // UjumbeSMS returns HTTP 200 with { success: true } on success
    //if (code === 200 && (json.success === true || json.status === 'success')) {
    if (code === 200 && (
  json.success === true ||
  json.status === 'success' ||
  (json.status && json.status.type === 'success') ||
  (json.status && json.status.code === '1008')
)) {
      return { success: true, sent: normalised.length, failed: 0 };
    }

    return {
      success: false,
      sent:    0,
      failed:  normalised.length,
      error:   json.message || json.error || ('HTTP ' + code + ': ' + body)
    };

  } catch (err) {
    Logger.log('sendSmsViaUjumbe exception: ' + err.toString());
    return { success: false, sent: 0, failed: normalised.length, error: err.toString() };
  }
}

// ============================================================
//  HELPER — returns a JSON ContentService response
// ============================================================

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}