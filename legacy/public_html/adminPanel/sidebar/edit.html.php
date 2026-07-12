<?php
               //tests for valid login    needs to be on every page
if (!isset($_SESSION))
{
session_start(); 
}
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}

?>


<!DOCTYPE html>
<html>
<head>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="description" content="The Grant County Holiday Project helps people in need or crisis with basic necessities during the Holiday season. Donations and volunteers are always welcome to assist needy families around the holidays. Money, material goods, time and talent are all appreciated for this worthy cause.">
        
	<title>Grant County Holiday Project helping people in need during the Holiday season</title>
	 <link rel="stylesheet" type="text/css" href="sidebar.css" media="all" /> 

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
<div id="header">Administration Panel</div>
<br><br><br>
			<div class="adminmenu">
			
					<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>	
				<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
				<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
				<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
				<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>
			
				<a href="../logout.php" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
			</div>
	
<div id="maincontent">

<br><br>
<blockquote><h5> >> Edit and Update Sidebar Data </h5></blockquote>



<div class="editSBTable">

<table width="200px" >

	<form  action="?edit" method="POST" name="updateForm">
		<tr><td>Current Sidebar Information </td></tr>

		<tr><td>Title<br>
		<input class="inputForm" type="text" name="txtTitle2" value="<?php echo $title ?>"></td></tr>
		
		
		<tr><td>Subtitle<br>
		<input class="inputForm"  type="text" name="txtSubtitle" value="<?php echo $subtitle ?>"></td><tr>
		
		<tr><td>Paragraph<br>
		<textarea rows="8" cols="35" name="txtPara"><?php echo $para ?> </textarea></td></tr>
		<tr><input type ="hidden" name='sbID' value="<?php echo $sbID ?>"><br>
		<th><br><input class="btn-style" type="submit"  value="Submit"></th></tr>
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