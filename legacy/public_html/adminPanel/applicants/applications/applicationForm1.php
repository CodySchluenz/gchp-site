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

	<div>
	<table>
		<tr><td>* First Name:</td>
		<input type = "hidden" name="appID" value="<?php echo $info['appID']; ?>" id="appID"/>
			<td><input type="text" name="fNameTXT" value="<?php echo $info['fName']; ?>" id="name"/></td>
			<td>* Last Name:</td>
			<td><input type="text" name="lNameTXT" value="<?php echo $info['lName']; ?>" id="lname"/></td>
		</tr>
		<tr><td>* Address:</td>
			<td><input type="text" name="addressTXT" value="<?php echo $info['address']; ?>" id="address"/></td>
			<td>* City:</td>
			<td><select name="citySEL" id="city">
				<option value="" selected>--SELECT--</option>
	////////////loading list of cities from database. 
<?php
		foreach ($cities as $city)
		{
			$id = $city['id'];
			$name = $city['name'];

			if($info['cityID'] == $id)
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
			<td><input type="text" name="phoneTXT" value="<?php echo $info['phone']; ?>" id="phone"/></td>
			<td colspan="2"><input type="checkbox" name="diabeticCHK" <?php if($info['diabetic'] == 1) echo "checked" ?> />Diabetic.<br />
							<input type="checkbox" name="treeCHK" <?php if($info['tree'] == 1) echo "checked" ?>  />Permission to adopt.<br /></td>
		</tr>
		<tr><td> Email:</td>
			<td><input type="text" name="emailTXT"  value="<?php echo $info['email']; ?>"  id="email"/></td>
		</tr>
		
		<tr>
			<td>
				&nbsp;Sheets&nbsp;&nbsp;<input type="radio" name="bedCHK" value="sheet" <?php if($info['bedType'] == "sheet") echo "checked" ?>  /><br />
			    Blanket&nbsp;&nbsp;<input type="radio" name="bedCHK" value="blanket" <?php if($info['bedType'] == "blanket") echo "checked" ?>  /></td>
			<td>
				Size: <br />
					  <select name="bedSEL">
						<option value="null" <?php if($info['bedSize'] == null) echo "selected" ?>>Select Size</option>
						<option value="twin" <?php if($info['bedSize'] == "twin") echo "selected" ?>>Twin</option>
						<option value="full" <?php if($info['bedSize'] == "full") echo "selected" ?>>Full</option>
						<option value="queen" <?php if($info['bedSize'] == "queen") echo "selected" ?>>Queen</option>
						<option value="king" <?php if($info['bedSize'] == "king") echo "selected" ?>>King</option>
					  </select>
			</td>
		</tr>
		<tr>
			<td>Application Date:</td>
			<td><input type="text" name="date"  value="<?php echo $info['date']; ?>"  id="date"/></td>
	</table>
	</div>
