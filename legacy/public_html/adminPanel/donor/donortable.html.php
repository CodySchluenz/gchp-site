<?php
if (!isset($_SESSION))
{
session_start(); 
}
               //tests for valid login    needs to be on every page
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

} ?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	
<title>GCHP Management Panel</title>
	<link rel="stylesheet" type="text/css" href="donor.css" media="all" />
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

<div id="main">
<div id="header"></div>
<div id="clearFloat"></div>	
<div class="adminmenu">

	<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>	
	<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="../logout.php" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>
<br>
<!-----------------------    MENU BAR    ---------------------->
<!-----------------------  END  MENU    ---------------------->
		
<div id="maincontent">
<div class="panelTable">
<blockquote>
<h3> Donor Management - View</h3><br>>>> <a href="?add">Add New Donor</A><br><br>

<form name="formName" action="?" method="POST">
			<label>Search by Name</label>
			<select name="listName">
			<option value="ALL">All</option>
			<?php 	
			foreach ($donors as $donor):
				echo "<option value='".$donor['donName']."'>".$donor['donName']."</option>";
					endforeach;
			?>
			</select>
			
			<p><input class="btn-style"  type="submit" value="Search"></p>
</form>






</blockquote>
</div>
</div>
<!----------------------  MAIN CONTENT ENDS ----------------------------->

	<div class="clearFloat"></div>
	<div id="footer">Admin Management Panel</div>
	<div class="clearFloat"></div>
</div>
</body>
</html>