<?php
// Set the content type to JSON for the response
header('Content-Type: application/json');

// Include the PHPMailer library
// Make sure the path is correct relative to this script
require_once('phpmailer/class.phpmailer.php');

// Initialize response array
$response = ['success' => false, 'message' => 'An unknown error occurred.'];

if (!empty($_POST)) {
    // --- Configuration ---
    $to_email = 'daniel@getgrowth.media';
    $from_email = 'no-reply@getgrowth.media'; // Using your domain email
    $from_name = 'Website Consultation Form';
    $subject = 'New Website Consultation Request';

    // --- (Optional but Recommended) reCAPTCHA Verification ---
    $recaptcha_secret = '6Lcu6ycrAAAAAOWVFSBX5qzIhFkwiaihoHJhpnDO'; // Your Secret Key
    $recaptcha_response = isset($_POST['g-recaptcha-response']) ? $_POST['g-recaptcha-response'] : '';

    // Verify reCAPTCHA (Uncomment this section to enable server-side check)
    /*
    if (!empty($recaptcha_secret) && !empty($recaptcha_response)) {
        $verify_url = 'https://www.google.com/recaptcha/api/siteverify';
        $data = [
            'secret' => $recaptcha_secret,
            'response' => $recaptcha_response,
            'remoteip' => $_SERVER['REMOTE_ADDR']
        ];
        $options = [
            'http' => [
                'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                'method' => 'POST',
                'content' => http_build_query($data),
                'timeout' => 5
            ]
        ];
        $context = stream_context_create($options);
        $verify_result = @file_get_contents($verify_url, false, $context);

        if ($verify_result === FALSE) {
             error_log("reCAPTCHA verification request failed.");
             $response['message'] = 'Sorry, could not verify reCAPTCHA. Please try again later. (Error: REQ_FAIL)';
             echo json_encode($response);
             exit;
        }

        $recaptcha_data = json_decode($verify_result);

        if ($recaptcha_data === null || !isset($recaptcha_data->success)) {
             error_log("reCAPTCHA verification response invalid.");
             $response['message'] = 'Sorry, could not verify reCAPTCHA. Please try again later. (Error: RESP_INVALID)';
             echo json_encode($response);
             exit;
        }

        if (!$recaptcha_data->success) {
            $error_codes = isset($recaptcha_data->{'error-codes'}) ? implode(', ', $recaptcha_data->{'error-codes'}) : 'N/A';
            error_log("reCAPTCHA verification failed. Error codes: " . $error_codes);
            $response['message'] = 'reCAPTCHA verification failed. Please go back and try again. (Error: VERIFY_FAIL)';
            echo json_encode($response);
            exit;
        }
    } else {
         $response['message'] = 'reCAPTCHA response missing. Please ensure JavaScript is enabled and try again.';
         echo json_encode($response);
         exit;
    }
    */
    // --- End reCAPTCHA Verification ---


    // --- Collect Form Data ---
    $firstName = isset($_POST['firstName']) ? strip_tags(trim($_POST['firstName'])) : '';
    $lastName = isset($_POST['lastName']) ? strip_tags(trim($_POST['lastName'])) : '';
    $phone = isset($_POST['phone']) ? strip_tags(trim($_POST['phone'])) : '';
    $email = isset($_POST['email']) ? filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL) : '';
    $website = isset($_POST['website']) ? strip_tags(trim($_POST['website'])) : 'Not provided';
    $datetime = isset($_POST['datetime']) ? strip_tags(trim($_POST['datetime'])) : 'Not provided';
    $message_text = isset($_POST['message']) ? strip_tags(trim($_POST['message'])) : '';
    // Retrieve the referrer URL sent from the form
    $referrerUrl = isset($_POST['referrerUrl']) ? strip_tags(trim($_POST['referrerUrl'])) : 'Not available';

    // Basic server-side validation
    if (empty($firstName) || empty($lastName) || empty($phone) || empty($email) || empty($message_text) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response['message'] = 'Please fill in all required fields correctly.';
        echo json_encode($response);
        exit;
    }


    // --- Prepare Email using PHPMailer ---
    $mail = new PHPMailer(true); // Passing true enables exceptions

    try {
        // Server settings (Optional - Configure SMTP if needed)
        /*
        $mail->IsSMTP(); $mail->SMTPDebug = 0; $mail->SMTPAuth = true;
        $mail->SMTPSecure = 'ssl'; $mail->Host = "smtp.example.com"; $mail->Port = 465;
        $mail->Username = "your_smtp_username@example.com"; $mail->Password = "your_smtp_password";
        */

        // Recipients
        $mail->SetFrom($from_email, $from_name);
        $mail->AddAddress($to_email);
        $mail->AddReplyTo($email, $firstName . ' ' . $lastName);

        // Content
        $mail->IsHTML(false);
        $mail->Subject = $subject;

        $message_body = "New consultation request details:\n\n";
        // Add the referrer URL to the email body
        $message_body .= "Submitted From Page: " . $referrerUrl . "\n\n";
        $message_body .= "First Name: " . $firstName . "\n";
        $message_body .= "Last Name: " . $lastName . "\n";
        $message_body .= "Phone: " . $phone . "\n";
        $message_body .= "Email: " . $email . "\n";
        $message_body .= "Website: " . $website . "\n";
        $message_body .= "Preferred Call Time: " . $datetime . "\n\n";
        $message_body .= "Message:\n" . $message_text . "\n";

        $mail->Body = $message_body;

        // Send the email
        if ($mail->Send()) {
            $response['success'] = true;
            $response['message'] = 'Thank you! Your consultation request has been sent. We\'ll contact you soon.';
        } else {
            error_log("Mailer Error: " . $mail->ErrorInfo);
            $response['message'] = 'Sorry, there was an error sending your request. Please try again later.';
        }

    } catch (phpmailerException $e) {
        error_log("Mailer Exception: " . $e->errorMessage());
        $response['message'] = 'Sorry, there was an error sending your request (Code: PME). Please try again later.';
    } catch (Exception $e) {
        error_log("General Exception: " . $e->getMessage());
        $response['message'] = 'Sorry, there was an error sending your request (Code: GE). Please try again later.';
    }

} else {
    $response['message'] = 'Invalid access method.';
}

// Send the JSON response back to the JavaScript
echo json_encode($response);
exit;
?>