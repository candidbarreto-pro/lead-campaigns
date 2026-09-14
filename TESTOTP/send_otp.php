<?php
header('Content-Type: application/json');

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

$phone = isset($_POST['phone']) ? preg_replace('/[^0-9]/', '', $_POST['phone']) : '';

if (strlen($phone) !== 10) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid phone number.']);
    exit;
}

$otp = rand(100000, 999999);
$sender_id = "KCONRG";

$message = "Hi, Greetings from Karma Group, Your verification code to access the Referral page is ".$otp.". DO NOT SHARE this code with anyone. Regards Karma Group.";

$response = Fstmsms($sender_id, $message, $phone);

$status = (stripos($response, 'success') !== false || stripos($response, 'ok') !== false || stripos($response, 'accepted') !== false) ? 'success' : 'failed';

try {
    $stmt = $pdo->prepare("INSERT INTO otp_logs (phone_number, otp, message, api_response, status) VALUES (:phone, :otp, :message, :response, :status)");
    $stmt->execute([
        ':phone' => $phone,
        ':otp' => $otp,
        ':message' => $message,
        ':response' => $response,
        ':status' => $status
    ]);
    
    if ($status === 'success') {
        echo json_encode(['status' => 'success', 'message' => 'OTP sent successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'SMS Gateway error. Response: ' . $response]);
    }
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error.']);
}

function Fstmsms($sender_id, $message, $number) {
    $apikey = "A62YMHQLr0STUVM78ZeEvA"; 
    $sender = $sender_id;
    $numbers = $number;
    $finalMessage = urlencode($message);

    $curl = curl_init();

    curl_setopt_array($curl, array(
        CURLOPT_URL => 'https://portal.vasudevsms.in/api/mt/SendSMS?senderid='.$sender.'&channel=Trans&DCS=0&flashsms=0&number='.$numbers.'&text='.$finalMessage.'&route=19&APIKey='.$apikey.'&DLTSenderId=1707169925580288750',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 30, 
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_SSL_VERIFYPEER => 0, 
    ));

    $response = curl_exec($curl);
    
    if (curl_errno($curl)) {
        $response = 'Curl error: ' . curl_error($curl);
    }

    curl_close($curl);
    return $response;
}
?>