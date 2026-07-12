<?PHP
session_start();
if (!$_SESSION["valid_user"])                     // tests for valid login... be on every page 
{
	// User not logged in, redirect to login page
	include 'login.php';
}
else 
{
	include 'admin.php';
}
?>


