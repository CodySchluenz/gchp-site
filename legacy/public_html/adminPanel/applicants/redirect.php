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
sleep(10);
?>

<html>
<head>
<title></title>
<meta http-equiv="REFRESH" content="0;url=applicants.php">
</head>
<body>
<h1>You will be redirected shortly.</h1>
</body>
</html>