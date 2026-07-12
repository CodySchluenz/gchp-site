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



?>
<!DOCTYPE html>
<html>
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
<div class="panelTable">
<blockquote>
<h3> Donor Management</h3>
<br>>>> <a href="?add">Add New Donor</A><br><br>
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
			<br><br><br>
			<p><input class="btn-style"  type="submit" value="Search"></p>
</form>
<br><br>
<p>Here are all Donors in the database:</p>
<table class="panelStyle">
<table width="100%">
	<tr>

	    <td>Full Name</td>
	    <td>Contact</td>
	    <td>Address</td>
	    <td>City</td>
	    <td>State</td>
	    <td>Zip Code</td>
	    <td>Phone</td>
	     <td>Email</td>
	    <td>Manage</td>
	 </tr>
	 <?php


	foreach ($donors as $donor): ?>
	<form action="#" method="post" name="viewForm">
	 <tr>
	 <td><?php echo $donor['donName']?></td>
	 <td><?php echo $donor['donContact']?></td>

	 <td><?php echo $donor['address']?></td>
	 <td><?php echo $donor['city']?></td>
	 <td><?php echo $donor['state']?></td>
	 <td><?php echo $donor['zip']?></td>
	 <td><?php echo $donor['phone']?></td>
	 <td><?php echo $donor['email']?></td>

	<td><input type='hidden' name='donID' value="<?php echo $donor['donID']; ?>">
		
	<input class="btn-style" type='submit' name='action' value='Delete'><br><br>
	<input class="btn-style" type='submit' name='action' value='Edit'>
</td></tr>
	
	

	</form>    
	<?php endforeach; ?>
	</table>




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