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
	echo "Are you sure you want to " . $endeavor . "?";
?>
<form action="#" method="post" name="confirmation">

<input class="inputBtn" type="submit" value="Yes" name="confirmation" id="submit"/>
<input class="inputBtn" type="submit" value="No" name="confirmation" id="submit"/>


</form>