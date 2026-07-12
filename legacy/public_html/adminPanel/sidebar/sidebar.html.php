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
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	
		<title>GCHP Management Panel</title>
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
<div id="header"></div>
<div id="clearFloat"><br></div>	
<div class="adminmenu">

	<a href="../index.php"><img align="middle"  src="imgs/home.png" /> ADMIN HOME</a>
	<a href="../donor/index.php" ><img align="middle" src="imgs/donor.png"/> DONORS</a>
	<a href="../applicants/applicants.php"><img align="middle"src="imgs/apps.png"/> APPLICANTS</a>
	<a href="../sidebar/index.php" ><img align="middle" src="imgs/sidebar.png"/> SIDEBAR</a>
	<a href="../pickup/index.php"><img align="middle" src="imgs/pickup.png"/> PICKUP SCHEDULE</a>

	<a href="../logout.php" ><img align="middle" src="imgs/logoff.png"/>LOGOUT</a>
</div>
<br><br>
<!-----------------------    MENU BAR    ---------------------->
<!-----------------------  END  MENU    ---------------------->
		
<div id="maincontent">


<blockquote><h5>>>>> Manage Sidebar </h5>
 <p><a href="?add">Add a new item to sidebar</a></p>
<br>
</blockquote>
<blockquote>
<div class="panelTable">
<table width="800px">
	<tr>
	<td width="25%">Title</td><td width="20%">Subtitle</td><td width="37%">Paragraph</td><td width="18%">Edit</td>
	</tr>	
<?php


	foreach ($bars as $bar): ?>
	<form action="?" method="post" name="viewForm">
<tr>
	<td width="25%"><?php echo $bar['title']?></td>
	<td width="20%"><?php echo $bar['subtitle']?></td>
	<td width="37%"><?php echo $bar['para']?></a> </td>

	<td width="18%"><input type='hidden' name='sbID' value="<?php echo $bar['sbID'];?>" />
	<input class="btn-style" type='submit' name='action' value='Delete'>
	<input class="btn-style" type='submit' name='action' value='Edit'></td></tr>
	

</form>
<?php endforeach;?>


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