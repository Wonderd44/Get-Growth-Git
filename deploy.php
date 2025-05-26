<?php
     $secret = 'PzwQIPn56etfOrkhYExqCgRdFqzktOd2'; // Replace with a secure token
     $hubSignature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
     $payload = file_get_contents('php://input');
     $hash = 'sha256=' . hash_hmac('sha256', $payload, $secret);
     if (hash_equals($hash, $hubSignature)) {
         $output = shell_exec('cd /home/ninnine8/public_html/getgrowth.media/dev && git pull origin main && /usr/local/cpanel/bin/git_deploy 2>&1');
         echo "<pre>$output</pre>";
     } else {
         http_response_code(403);
         echo "Invalid signature";
     }
     ?>
