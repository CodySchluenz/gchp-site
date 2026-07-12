<?php
if ($_GET['randomId'] != "1nXN6gGpztbPpC_Ky0tcdwoYD5UlVorfKS3_sHa1R6v35vVM1R1562eonPw6Qbz_") {
    echo "Access Denied";
    exit();
}

// display the HTML code:
echo stripslashes($_POST['wproPreviewHTML']);

?>  
