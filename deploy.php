<?php

// Set your webhook secret (this must match GitHub's webhook secret)
$secret = 'PzwQIPn56etfOrkhYExqCgRdFqzktOd2'; 

// Get the signature sent by GitHub
$hubSignature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

// Get the payload from GitHub
$payload = file_get_contents('php://input');

// Compute the HMAC hash
$hash = 'sha256=' . hash_hmac('sha256', $payload, $secret);

// Compare the computed hash with the received signature
if (hash_equals($hash, $hubSignature)) {

    // Go to your project directory and pull the latest changes
    $output = shell_exec('cd /home/ninnine8/public_html/getgrowth.media/dev && git pull origin main 2>&1');

    echo "<pre>$output</pre>";

} else {
    http_response_code(403);
    echo "Invalid signature";
}
?>
