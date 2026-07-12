<?php
if (!isset($_SESSION))
{
session_start(); 
}
               //tests for valid login    needs to be on every page
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location:login.php");

}
?>

<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	
	<title>GCHP Management Panel</title>
	<link rel="stylesheet" type="text/css" href="adminPanel.css" media="all" />
	<!--[if IE]>
	<style type="text/css" media="all">.borderitem {border-style: solid;}</style>
	<![endif]-->
		<style type="text/css">
	body {
	background-color: #002222;  
}


    </style>
</head>

<body>


<script type="text/javascript">
<!--

function MM_openBrWindow(theURL,winName,features) { 
  window.open(theURL,winName,features);
}

</script>

<div id="main">
<div id="header"></div>
<div id="clearFloat"><br></div>	
<div class="adminmenu">

	<a href="admin.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME </a>	
	<a href="donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="pickup/"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="logout.php" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>
<br><br><br>	
<!-----------------------    MENU BAR    ---------------------->
<!-----------------------  END  MENU    ---------------------->
	
<div id="maincontent">
<br> 

<blockquote><h4>Welcome to the Grant County Holiday Project Administrator Control Panel </h4>
<div id="cc"></div><br><br>
<p><a href="upload.php" onclick="MM_openBrWindow('upload.php','Upload Application','scrollbars=yes,width=375,height=150'); return false;"><img align="middle" src="imgs/pdf.jpg"/>>> Upload PDF Application</a></p>
<br><br>
<p><a href="upload/gchpManual.pdf"><img align="middle" src="imgs/guide.jpg"/> >> User Guide</a></p>
<br><br><br>


<table width="90%">

</table>
</blockquote>
</div>
<!----------------------  MAIN CONTENT ENDS ----------------------------->

<div class="clearFloat"></div>
<div id="footer">Admin Management Panel</div>
<div class="clearFloat"></div>
</div>
</body>
</html>