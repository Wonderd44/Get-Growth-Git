<?php
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once('../phpmailer/class.phpmailer.php');

header('Content-Type: application/json');

if (!isset($_POST['jsonData'])) {
    echo json_encode(['success' => false, 'message' => 'Error: jsonData not provided.']);
    exit;
}

$jsonData = $_POST['jsonData'];
$decodedData = json_decode($jsonData, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['success' => false, 'message' => 'Error: Invalid JSON data provided. ' . json_last_error_msg()]);
    exit;
}

if (!isset($decodedData['step']) || !isset($decodedData['data'])) {
    echo json_encode(['success' => false, 'message' => 'Error: Missing step or data in JSON.']);
    exit;
}

$step = $decodedData['step'];
$formData = $decodedData['data'];

$mail = new PHPMailer();

$mail->IsMail(); // Using local mail setup
$mail->CharSet = 'UTF-8';

// Email Parameters
$mail->From = 'noreply@yourdomain.com'; // Replace with your actual domain or a placeholder
$mail->FromName = 'Checkout System';
$mail->AddAddress('daniel@getgrowth.media'); // Recipient

// Email Content
$mail->Subject = "Checkout Step {$step} Data Received";

$body = "<h1>Data from Checkout Step {$step}:</h1>";
foreach ($formData as $key => $value) {
    $body .= "<p><strong>" . htmlspecialchars($key) . ":</strong> " . htmlspecialchars($value) . "</p>";
}
$mail->Body = $body;
$mail->isHTML(true);

// Attempt to send the email
if ($mail->send()) {
    echo json_encode(['success' => true, 'message' => 'Email sent successfully for step ' . $step]);
} else {
    echo json_encode(['success' => false, 'message' => 'Mailer Error for step ' . $step . ': ' . $mail->ErrorInfo]);
}
?>
