<?php
     $secret = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC32G0VDiNPaQDt+bkOzGAdl56Gn7GnLus+uQPMBfz3K02PAEc8e8ZQYAHBO2I/24hAzzZI+ArJ5ZWe4HuDxnbh2cgAIWfRGKDBZ54ZkSEElz6TVaS+32rJfseUvg6y+Yz61GSlTJbWfvhmaTooYv36jxcdWjOXEIMF95hLpOkiydaLC7WrYAUteXI/HTUxs8ES41xwUfq9/tnL7tPPLG36KEWxqJeOqziYTIibQP7Wy/PdlJPYzGgn9poJmx0shvU9TP5lKUJ3+M3m4Yv5InXmlpSl6/7eEiicDz7/XlQJGZ8fww/dIHZl7pQydRS/jA8gcD/8lDJd5ZLbaDTpynmr4c+NbO6xMH9WVNXyKKaGG0dnnliTo/ecvBbzb+7iPRbi/gvT0+mcSLeqhtX8O7MIWoqWMTsaWW2a1EyNKLeqWJjdLkKjGUlOVHhYkUUtqy6WCLfdcfwRS3x5TteBUn6EYM1Q1IA/IhX70T4MQG+qOQrKxUVvikOhDHUFC+z1ll1jZko8cha3dVfwy4acwG2P569ImvyzTPLlAtXiegKn7xvfcX0mrRIW8UTafTuefO1jjWiyVgRfh/tDLxshYl8YMr6eFrmDbo1LqjWtPDEOJZpTgo7C3Wb6bnloW5eRIu+GziY8+rkw0VYy+S7Fe2oGwKFrvExLFN0iX8JZAsqJ/w=='; // Replace with a secure token
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
