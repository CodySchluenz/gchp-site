<?php
if (!isset($_SESSION))
{
session_start(); 
}

		
	
	// Load city list from database.
	try
	{
		$sql = 'SELECT cityName, cityID FROM cities ORDER BY cityName;';
		$result = $pdo->query($sql);
	}
	catch (PDOException $e)
	{
		$error = 'Error fetching Cities: ' . $e->getMessage();
		echo $error;
		exit();
	}
	
	while ($row = $result->fetch())
{
	$cities[] = array ('id' => $row['cityID'],
	'name' => $row['cityName']);
}

	
	?>
<form action="#" method="post" name="appForm1">
<p>DO NOT close your browser or use your browsers back button once you have proceeded to step 2. Please use the back button and cancel button provided.</p><br>
* denotes a required field
<div class="panelTable">
	<table>
		<tr><td colspan="4" style="text-align:center">You must be a resident of Grant County Wisconsin to receive this service</td></tr>
		<tr><td>* First Name:</td>
			<td><input type="text" name="fNameTXT" value="<?php echo $_SESSION['app1'][0]; ?>" id="name"/></td>
			<td>* Last Name:</td>
			<td><input type="text" name="lNameTXT" value="<?php echo $_SESSION['app1'][1]; ?>" id="lname"/></td>
		</tr>
		<tr><td>* Address:</td>
			<td><input type="text" name="addressTXT" value="<?php echo $_SESSION['app1'][2]; ?>" id="address"/></td>
			<td>* City:</td>
			<td><select name="citySEL" id="city">
				<option value="" selected>--SELECT--</option>
	////////////loading list of cities from database. 
<?php
		foreach ($cities as $city)
		{
			$id = $city['id'];
			$name = $city['name'];

			if($_SESSION['app1'][3] == $id)
			{
				echo "<option value='".$id."' selected>".$name."</option>";
			} 
			else
			{
				echo "<option value='".$id."'>".$name."</option>";
			}
		}
	?>
				</select>
			</td>
		</tr>
		<tr><td>* Phone:</td>
			<td><input type="text" name="phoneTXT" value="<?php echo $_SESSION['app1'][4]; ?>" id="phone"/></td>
			<td colspan="2"><input type="checkbox" name="diabeticCHK" <?php if($_SESSION['app1'][5] == 1) echo "checked" ?> />&nbsp;&nbsp;Check if a member of your household is diabetic.<br />
							<input type="checkbox" name="treeCHK" <?php if($_SESSION['app1'][6] == 1) echo "checked" ?>  />&nbsp;&nbsp;Check-I give permission to adopt my family to other organizations (confidential) <br /></td>
		</tr>
		<tr><td> Email:</td>
			<td><input type="text" name="emailTXT"  value="<?php echo $_SESSION['app1'][7]; ?>"  id="email"/></td>
			<td> Confirm Email:</td>
			<td><input type="text" name="email2TXT" value="<?php echo $_SESSION['app1'][7]; ?>" id="email2"/></td>
		</tr>
		
		<tr>
			<td colspan="2">If you wish to have either a blanket or <br />sheets select one.</td>
			<td>
				&nbsp;Sheets&nbsp;&nbsp;<input type="radio" name="bedCHK" value="sheet" <?php if($_SESSION['app1'][8] == "sheet") echo "checked" ?>  /><br />
			    Blanket&nbsp;&nbsp;<input type="radio" name="bedCHK" value="blanket" <?php if($_SESSION['app1'][8] == "blanket") echo "checked" ?>  /></td>
			<td>
				Size: <br />
					  <select name="bedSEL">
						<option value="null" <?php if($_SESSION['app1'][9] == null) echo "selected" ?>>Select Size</option>
						<option value="twin" <?php if($_SESSION['app1'][9] == "twin") echo "selected" ?>>Twin</option>
						<option value="full" <?php if($_SESSION['app1'][9] == "full") echo "selected" ?>>Full</option>
						<option value="queen" <?php if($_SESSION['app1'][9] == "queen") echo "selected" ?>>Queen</option>
						<option value="king" <?php if($_SESSION['app1'][9] == "king") echo "selected" ?>>King</option>
					  </select>
			</td>
		</tr>
	</table>
	</div>
<div class="form_settings"><br>
<input class="inputBtn" type="submit" value="Next" name="appPt1" id="submit"/></div>
</form>