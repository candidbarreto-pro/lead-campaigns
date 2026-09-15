<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method.', 405);
}

$input = $_POST;
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (stripos($contentType, 'application/json') !== false) {
    $json = json_decode(file_get_contents('php://input'), true);
    if (is_array($json)) {
        $input = $json;
    }
}

$action = trim((string)($input['action'] ?? ''));

try {
    switch ($action) {
        case 'send_otp':
            sendOtp($pdo, $input);
            break;
        case 'verify_otp':
            verifyOtp($pdo, $input);
            break;
        case 'submit':
            submitLead($pdo, $input);
            break;
        default:
            respond(false, 'Invalid action.', 400);
    }
} catch (Throwable $e) {
    respond(false, 'Server error. Please try again.', 500);
}

function sendOtp(PDO $pdo, array $input): void
{
    $phone = cleanPhone($input['mobile'] ?? $input['phone']?? '');

    if (!preg_match('/^[6-9][0-9]{9}$/', $phone)) {
        respond(false, 'Enter a valid 10-digit Indian mobile number.', 422);
    }

    $stmt = $pdo->prepare("SELECT created_at FROM otp_logs WHERE phone_number = :phone ORDER BY id DESC LIMIT 1");
    $stmt->execute([':phone' => $phone]);
    $last = $stmt->fetch();

    if ($last && strtotime($last['created_at']) > time() - 60) {
        $remaining = max(1, 60 - (time() - strtotime($last['created_at'])));
        respond(false, "Please wait {$remaining} seconds before requesting another OTP.", 429);
    }

    $otp = (string)random_int(100000, 999999);
    $senderId = 'KCONRG';
    $message = 'Hi, Greetings from Karma Group, Your verification code to access the Referral page is ' . $otp . '. DO NOT SHARE this code with anyone. Regards Karma Group.';

    $gateway = Fstmsms($senderId, $message, $phone);
    $responseText = $gateway['body'];
    $success = gatewaySuccess($gateway['body'], $gateway['http_code'], $gateway['curl_error']);
    
    $stmt = $pdo->prepare(
        "INSERT INTO otp_logs (phone_number, otp_hash, message, api_response, status, attempts, expires_at)
         VALUES (:phone, :otp_hash, :message, :response, :status, 0, DATE_ADD(NOW(), INTERVAL 5 MINUTE))"
    );

    $stmt->execute([
        ':phone' => $phone,
        ':otp_hash' => hash('sha256', $otp),
        ':message' => $message,
        ':response' => $responseText,
        ':status' => $success ? 'sent' : 'failed'
    ]);

    if (!$success) {
        $detail = $gateway['curl_error'] ?: trim($responseText);
        if ($gateway['http_code']) {
            $detail = 'HTTP ' . $gateway['http_code'] . ($detail ? ': ' . $detail : '');
        }
        respond(false, $detail ? 'SMS Gateway error: ' . $detail : 'SMS Gateway error.', 502);
    }

    $_SESSION['otp_phone'] = $phone;
    respond(true, 'OTP sent successfully please check your phone.');
}

function verifyOtp(PDO $pdo, array $input): void
{
    $phone = cleanPhone($input['mobile'] ?? $input['phone'] ?? '');
    $otp = preg_replace('/\D/', '', (string)($input['otp'] ?? ''));

    if (!preg_match('/^[6-9][0-9]{9}$/', $phone)) {
        respond(false, 'Invalid mobile number.', 422);
    }

    if (!preg_match('/^[0-9]{6}$/', $otp)) {
        respond(false, 'Enter the 6-digit OTP.', 422);
    }

    $stmt = $pdo->prepare("SELECT id, otp_hash, expires_at, attempts, status FROM otp_logs WHERE phone_number = :phone AND status = 'sent' ORDER BY id DESC LIMIT 1");

    $stmt->execute([':phone' => $phone]);
    $record = $stmt->fetch();

    if (!$record) {
        respond(false, 'NO active OTP found for this number. Please request a new OTP.', 422);
    }

    if (strtotime($record['expires_at']) < time()) {
        respond(false, 'OTP has expired. Please request a new OTP.', 422);
    }

    if ((int)$record['attempts'] >= 5) {
        respond(false, 'Too many incorrect attempts. Please request a new OTP.', 429);
    }

    if (!hash_equals($record['otp_hash'], hash('sha256', $otp))) {
        $update = $pdo->prepare("UPDATE otp_logs SET attempts = attempts + 1 WHERE id = :id");
        $update->execute([':id' => $record['id']]);
        respond(false, 'Incorrect OTP. Please try again.', 422);
    }

    $update = $pdo->prepare("UPDATE otp_logs SET status = 'verified', verified_at = NOW() WHERE id = :id");
    $update->execute([':id' => $record['id']]);

    $_SESSION['otp_verified_phone'] = $phone;
    $_SESSION['otp_verified_at'] = time();

    respond(true, 'Mobile number verified successfully.');
}

function submitLead(PDO $pdo, array $input): void
{
    $firstName = trim((string)($input['first_name'] ?? ''));
    $lastName = trim((string)($input['last_name'] ?? ''));
    $dob = trim((string)($input['date_of_birth'] ?? ''));
    $maritalStatus = trim((string)($input['maritalstatus'] ?? $input['marital_status'] ?? ''));
    $mobile = cleanPhone($input['mobile'] ?? '');
    $email = trim((string)($input['email'] ?? ''));
    $state = trim((string)($input['state'] ?? ''));
    $destination = trim((string)($input['destination'] ?? ''));
    $consent = (int)($input['consent'] ?? 0);
    $disclaimer = (int)($input['disclaimer'] ?? 0);

    if ($firstName === '' || $lastName === '' || $dob === '' || $maritalStatus === '' || $email === '' || $state === '' || $destination === '') {
        respond(false, 'Please complete all required fields.', 422);
    }

    if (!preg_match('/^[6-9][0-9]{9}$/', $mobile)) {
        respond(false, 'Enter a valid 10-digit Indian mobile number.', 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(false, 'Enter a valid email address.', 422);
    }

    if (!$consent || !$disclaimer) {
        respond(false, 'Please accept both declarations.', 422);
    }

    $verifiedPhone = $_SESSION['otp_verified_phone'] ?? '';
    $verifiedAt = (int)($_SESSION['otp_verified_at'] ?? 0);

    if ($verifiedPhone !== $mobile || $verifiedAt < time() - 600) {
        respond(false, 'Please verify your mobile number before submitting.', 422);
    }

    $dobDate = DateTime::createFromFormat('Y-m-d', $dob);
    if (!$dobDate || $dobDate->format('Y-m-d') !== $dob) {
        respond(false, 'Enter a valid date of birth.', 422);
    }

    $stmt = $pdo->prepare(
        "INSERT INTO leads
        (first_name, last_name, date_of_birth, marital_status, mobile, email, state, destination, consent, disclaimer)
        VALUES (:first_name, :last_name, :date_of_birth, :marital_status, :mobile, :email, :state, :destination, :consent, :disclaimer)"
    );

    $stmt->execute([
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':date_of_birth' => $dob,
        ':marital_status' => $maritalStatus,
        ':mobile' => $mobile,
        ':email' => $email,
        ':state' => $state,
        ':destination' => $destination,
        ':consent' => $consent,
        ':disclaimer' => $disclaimer
    ]);

    unset($_SESSION['otp_verified_phone'], $_SESSION['otp_verified_at'], $_SESSION['otp_phone']);

    respond(true, 'Your enquiry has been submitted successfully.');
}

function cleanPhone($phone): string
{
    return preg_replace('/[^0-9]/', '', (string)$phone);
}

function Fstmsms(string $senderId, string $message, string $number): array
{
    $apiKey = 'A62YMHQLr0STUVM78ZeEvA';
    $dltSenderId = '1707169925580288750';

    $url = 'https://portal.vasudevsms.in/api/mt/SendSMS?' .
        'senderid=' . urlencode($senderId) .
        '&channel=Trans' .
        '&DCS=0' .
        '&flashsms=0' .
        '&number=' . urlencode($number) .
        '&text=' . urlencode($message) .
        '&route=19' .
        '&APIKey=' . urlencode($apiKey) .
        '&DLTSenderId=' . urlencode($dltSenderId);

    $curl = curl_init();

    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false
    ]);

    $body = curl_exec($curl);
    $curlError = $body === false ? curl_error($curl) : '';
    $httpCode = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    return [
        'body' => $body === false ? '' : $body,
        'http_code' => $httpCode,
        'curl_error' => $curlError
    ];
}

function gatewaySuccess(string $response, int $httpCode, string $curlError): bool
{
    if ($curlError !== '' || ($httpCode !== 0 && ($httpCode < 200 || $httpCode >= 300))) {
        return false;
    }

    $text = trim($response);
    if ($text === '') {
        return false;
    }

    $decoded = json_decode($text, true);
    if (is_array($decoded)) {
        $errorCode = strtolower(trim((string)($decoded['ErrorCode'] ?? $decoded['errorCode'] ?? $decoded['code'] ?? '')));
        $errorMessage = strtolower(trim((string)($decoded['ErrorMessage'] ?? $decoded['errorMessage'] ?? $decoded['message'] ?? $decoded['Message'] ?? '')));
        $status = strtolower(trim((string)($decoded['status'] ?? $decoded['Status'] ?? $decoded['type'] ?? '')));

        if ($errorCode === '000' || $status === 'success' || $status === 'ok' || $status === 'accepted' || $status === 'sent' || $status === 'successfully') {
            return true;
        }

        if (strpos($errorMessage, 'success') !== false || strpos($errorMessage, 'accepted') !== false || strpos($errorMessage, 'sent') !== false || $errorMessage === 'ok') {
            return true;
        }

        if ($status === 'error' || $status === 'failed' || $status === 'failure' || $status === 'rejected' || $status === 'invalid') {
            return false;
        }
    }

    $lower = strtolower($text);
    foreach (['error', 'failed', 'failure', 'invalid', 'unauthorized', 'rejected', 'unsuccessful'] as $word) {
        if (strpos($lower, $word) !== false) {
            return false;
        }
    }

    return strpos($lower, 'success') !== false ||
        strpos($lower, 'accepted') !== false ||
        strpos($lower, 'sent') !== false ||
        preg_match('/\bok\b/', $lower) === 1;
}

function respond(bool $success, string $message, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode([
        'success' => $success,
        'status' => $success ? 'success' : 'error',
        'message' => $message
    ]);
    exit;
}
