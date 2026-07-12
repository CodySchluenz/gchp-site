<?php
if (!isset($_SESSION))
{
session_start(); 
}
//               tests for valid login    needs to be on every page

if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}
	if($_POST['treeCHK'] == "on")
	{
		$tree = 1;
	}
	else
	{
		$tree = 0;
	}
	if($_POST['diabeticCHK'] == "on")
	{
		$diabetic = 1;
	}
	else
	{
		$diabetic = 0;
	}


?>
<br> <br>


<table>
		<tr><th colspan="6" style="text-align:center"><u>Total</u> Household Income of <u>All Living</u> in Household<br /></th></tr>
		<tr><td>Employer 1:</td>
			<td><input type="text" name="emp1TXT" value="<?php echo $info['employer1'] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage1TXT" value="<?php echo $info['wage1'] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek1TXT" value="<?php echo $info['hrsPerWk1'] ?>" /></td>
			<td><input type='submit' name='deleteEmp1' value='DELETE Employer 1' /></td>
		</tr>
		<tr><td>Employer 2:</td>
			<td><input type="text" name="emp2TXT" value="<?php echo $info['employer2'] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage2TXT" value="<?php echo $info['wage2'] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek2TXT" value="<?php echo $info['hrsPerWk2'] ?>" /></td>
			<td><input type='submit' name='deleteEmp2' value='DELETE Employer 2' /></td>
		</tr>
		<tr><td>Employer 3:</td>
			<td><input type="text" name="emp3TXT" value="<?php echo $info['employer3'] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage3TXT" value="<?php echo $info['wage3'] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek3TXT" value="<?php echo $info['hrsPerWk3'] ?>" /></td>
			<td><input type='submit' name='deleteEmp3' value='DELETE Employer 3' /></td>
		</tr>
		<tr><td>Employer 4:</td>
			<td><input type="text" name="emp4TXT" value="<?php echo $info['employer4'] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage4TXT" value="<?php echo $info['wage4'] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek4TXT" value="<?php echo $info['hrsPerWk4'] ?>" /></td>
			<td><input type='submit' name='deleteEmp4' value='DELETE Employer 4' /></td>
		</tr>
	</table>
