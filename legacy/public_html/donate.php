<?php
/*               tests for valid login    needs to be on every page
session_start();
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}
*/

include_once "includes/databasesetup.php";






/////////////////////////////////////////////////////////////////////////////////



//  add donor to the database
if (isset($_GET['add']))
{
  include 'newDonorform.html.php';
  exit();

}

if (isset($_POST['txtdonName']))
{
	  try
  {

	    $sql = 'INSERT INTO donor SET
			donID = :donID,

			donName = :donName,
			donContact = :donContact,
			address = :address,
			city  = :city,
			state = :state,
			zip  = :zip,
			phone  = :phone,
			email = :email';
		
		
		    $s = $pdo->prepare($sql);
		    
    $s->bindValue(':donID', $_POST['donID']);
	$s->bindValue(':donName', $_POST['txtdonName']);
	$s->bindValue(':donContact', $_POST['txtdonContact']);
	$s->bindValue(':address', $_POST['txtaddress']);
	$s->bindValue(':city', $_POST['txtcity']);
	$s->bindValue(':state', $_POST['txtstate']);
	$s->bindValue(':zip', $_POST['txtzip']);
	$s->bindValue(':phone', $_POST['txtphone']);
	$s->bindValue(':email', $_POST['txtemail']);

   	 $s->execute();
		
  }
catch (PDOException $e)
{
  $error = 'Error fetching donor data: ' . $e->getMessage();
  echo $error;
  exit();
}
}


 ?>



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

<div id="donorcontent">
<blockquote><br><br><br><br><br><br>
<h1>Donate</h1><br><br>

<p style="text-align:center;" >Your tax deductable donations are what make The Grant County Holida Project possible.<br> We greatly appreciate your support. <br><br>
<h3> We also offer online payments though PayPal!<br>
<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="AX2RXSFRCFKZQ"><br><br>
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form></h3>



	</div>
	<div class="clearFloat"></div>
<div id="footer"> Grant County Holiday Project | <a href="http://grantcounty.org/" target="_blank">Official Grant Co. Website</a> | <a href="adminPanel/login.php">Admin</a></div><br><br>
	<div class="clearFloat"></div>
</div>
</body>
</html>