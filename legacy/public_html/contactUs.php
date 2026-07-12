<!DOCTYPE html>
<html>
<head>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="description" content="The Grant County Holiday Project helps people in need or crisis with basic necessities during the Holiday season. Donations and volunteers are always welcome to assist needy families around the holidays. Money, material goods, time and talent are all appreciated for this worthy cause.">
        
	<title>Grant County Holiday Project helping people in need during the Holiday season</title>
	 <link rel="stylesheet" type="text/css" href="index.css" media="all" /> 

	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
			<style type="text/css">
	body {
	background-color: #003300;  
}


    </style>
</head>

<body>

<div id="main">
<div class="clearFloat"></div>
<div id="header"></div>	
<div class="clearFloat">
<!--///////////////////    MENU BAR BUTTONS  ////////////////////////-->
	<a href="index.php" class="btn_Home">Home</a>
			<a href="donate.php" class="btn_Donate">Donate</a>
			<a href="application/application.php" class="btn_App">Application</a>
			<a href="contactUs.php" class="btn_ContactUs">Contact Us</a>
			<p class="btn_right">&nbsp;</p>
			</div>

<div id="widecontent">
<br><br><br>
<blockquote><blockquote><h1>CONTACT US:</h1><br>

Be sure to include your email so we know where to send the response.
<br><br> * required field <br><br>
<?php
// display form if user has not clicked submit
if (!isset($_POST["submit"])) {
  ?>
  <form method="post" action="<?php echo $_SERVER["PHP_SELF"];?>">
  Email: &nbsp;&nbsp;<input type="text" name="from"><br><br>
  Subject: <input type="text" name="subject"><br><br>
  Message: <textarea rows="10" cols="40" name="message"></textarea><br><br>
  <input class="inputBtn" type="submit" name="submit" value="Submit">
  </form>
  <?php
} else {    // the user has submitted the form
  // Check if the "from" input field is filled out
  if (filter_var($_POST['from'], FILTER_VALIDATE_EMAIL)) 
	{
    $from = $_POST['from']; // sender
    $subject = $_POST['subject'];
    $message = $_POST['message'];
    // message lines should not exceed 70 characters (PHP rule), so wrap it
    $message = wordwrap($message, 70);
    // send mail
    mail("skleinow@co.grant.wi.gov",$subject,$message,"From: $from\n");
    echo "Thank you for sending us feedback";
  }
  else
  	echo "Invalid email address.";
}
?>
</form>
</blockquote></blockquote>



<!----------------------  MAIN CONTENT TEXT AND CODE GO HERE ----------------------------->

	</div>
	<div class="clearFloat"></div>
<div id="footer"> Grant County Holiday Project | <a href="http://grantcounty.org/" target="_blank">Official Grant Co. Website</a> | <a href="adminPanel/login.php">Admin</a></div><br><br>
	<div class="clearFloat"></div>
</div>
</body>
</html>