<?php
if (!isset($_SESSION))
{
session_start(); 
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


<div class="panelTable">
<form action="#" method="post" name="appForm2">
<table>
		<tr><td colspan="6" style="text-align:center">TotalHousehold Income of All Livingin Household</td></tr>
		<tr><td>Employer 1:</td>
			<td><input type="text" name="emp1TXT" value="<?php echo $_SESSION['app2'][0] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage1TXT" value="<?php echo $_SESSION['app2'][1] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek1TXT" value="<?php echo $_SESSION['app2'][2] ?>" /></td>
		</tr>
		<tr><td>Employer 2:</td>
			<td><input type="text" name="emp2TXT" value="<?php echo $_SESSION['app2'][3] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage2TXT" value="<?php echo $_SESSION['app2'][4] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek2TXT" value="<?php echo $_SESSION['app2'][5] ?>" /></td>
		</tr>
		<tr><td>Employer 3:</td>
			<td><input type="text" name="emp3TXT" value="<?php echo $_SESSION['app2'][6] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage3TXT" value="<?php echo $_SESSION['app2'][7] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek3TXT" value="<?php echo $_SESSION['app2'][8] ?>" /></td>
		</tr>
		<tr><td>Employer 4:</td>
			<td><input type="text" name="emp4TXT" value="<?php echo $_SESSION['app2'][9] ?>" /></td>
			<td>Hourly Wage:</td>
			<td><input type="text" size="5" name="hWage4TXT" value="<?php echo $_SESSION['app2'][10] ?>" /></td>
			<td>Hours/Week:</td>
			<td><input type="text" size="3" name="hWeek4TXT" value="<?php echo $_SESSION['app2'][11] ?>" /></td>
		</tr>
	</table>
	</div><br><br>
<div class="form_settings">
<input class="inputBtn" type="submit" value="Back" name="back" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Cancel" name="cancel" onclick="show_confirm()" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Next" name="appPt2" />
</div>
</form>