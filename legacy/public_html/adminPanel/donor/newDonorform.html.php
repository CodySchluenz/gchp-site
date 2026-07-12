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

}

include '../../includes/databasesetup.php';


?>
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
<br><br><br><br><br><br><br>	
<!-----------------------    MENU BAR    ---------------------->
<div class="adminmenu">

	<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>
	<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="?logout" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>	
<div id="maincontent">
<blockquote> >>  Add Donor
<div class="addSBTable">
<br><br>
<table>
<form  action="?" method="post">

<tr>
	
	<tr><td >Full Name <br>  <textarea rows="1" cols="30" input type="text" name="txtdonName" /></textarea></td></tr>
	<tr><td >Donator Contact<br>  <textarea rows="1" cols="30" input type="text" name="txtdonContact" /></textarea></td></tr>
	<tr><td>Email<br> <textarea rows="1" cols="30" input type="text" name="txtemail" /></textarea></td></tr>
	<tr><td>Home Phone<br><textarea rows="1" cols="30" input type="text" name="txtphone" /></textarea></td></tr>									
	
        <tr><td>Address <br> <textarea rows="1" cols="30" input type="text" name="txtaddress" /></textarea></td> </tr>
        <tr><td>City<br><textarea rows="1" cols="30" input type="text" name="txtcity" /></textarea></td></tr>
	
									
	
	<tr><td>State<br> <input type="text" name="txtstate"/></td>  <tr>

        <tr><td>Zip Code<br> <input type="text" name="txtzip" /></td><tr><br><th><br><input class="btn-style" type="submit" value= "Add"  /></th>	
	

</tr>
</form>
</table>

</div>
</div>
<!----------------------  MAIN CONTENT ENDS ----------------------------->

	<div class="clearFloat"></div>
	<div id="footer">Admin Management Panel</div>
	<div class="clearFloat"></div>
</div>
</body>
</html>