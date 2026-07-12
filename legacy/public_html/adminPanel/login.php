<?php
session_start();
if(isset($_GET['op']))
{
 	$error = "";
	if (!isset($_POST['txtAdminUser']) || $_POST['txtAdminUser'] == '' || !isset($_POST['txtAdminPassword']) || $_POST['txtAdminPassword'] == '')
	{
		$error = 'Please provide a username and password.<br /><br />';
 	}
 	 else
 	 {
		include "../includes/databasesetup.php";
		
		try
		{
			 $sql = 'SELECT COUNT(*) from admin
			 	WHERE UserName = :username and Password = :password';
			  $s = $pdo->prepare($sql);
			  $s->bindValue(':username', $_POST["txtAdminUser"]);
			  $s->bindValue(':password', $_POST["txtAdminPassword"]);
			  $s->execute();
		 }
		 catch (PDOException $e)
		 {
			  $error = 'Error fetching admin login: ' . $e->getMessage();
			  echo $error;
			  exit();
		 }
	
		$row = $s->fetch();


		 if ($row[0] > 0 && $error == "")
		 {
			// Login successful, create session variables
			$_SESSION["valid_user"] = $_POST["txtAdminUser"];
			$_SESSION["valid_password"] = $_POST["txtAdminPassword"];
		
		 	include 'admin.php';
		  	exit();
		}
 		else
		{
			$error = "Wrong login information<br /><br />";
		}
 	}
}

	?>
<!DOCTYPE html>

<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<title>Grant County Holiday Project</title>
	 <link rel="stylesheet" type="text/css" href="adminLogin.css" media="all" /> 
	<style type="text/css">
	body {
	background-color: #002222;
  
}
    </style>

</head>
<body>
<div id="maincontent">
<a href="http://www.grantcountyholidayproject.com" class="button red">Home</a>

<div id="box"><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
<?php

echo "<br /><br /><form action='?op=login' method='POST'>";
echo "Please login below to access the control center.<br /><br /><br /><br />";
if($error != "")
	echo $error;
echo "Username:<br><input class='inputForm' type='text'  name='txtAdminUser' /><br /><br />";
echo "Password:<br><input class='inputForm' type='password' name='txtAdminPassword' /><br /><br />";
echo "<p><input class='btn-style' type='Submit' value='Login' /></p>";
 
?>

		
	
</div></div>
</body>
</html>