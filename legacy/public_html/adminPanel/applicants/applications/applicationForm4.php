<?PHP
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
try
{
	$sql = 'select * from children where appID = ' . $appID;
	$getChildren = $pdo->query($sql);				
}
catch (PDOException $e)
{
  $error = 'Error fetching Children: ' . $e->getMessage();
  echo $error;
  exit();
}


while ($row = $getChildren->fetch())
{
	$children[] = array ('appID'=>$row['appID'],
	'childID'=>$row['childID'],
	'name'=>$row['name'],
	'sex'=>$row['sex'],
	'age'=>$row['age'],
	'pantSize'=>$row['pantSize'],
	'shirtSize'=>$row['shirtSize'],
	'undSize'=>$row['undSize'],
	'sockSize'=>$row['sockSize'],
	'diaperSize'=>$row['diaperSize'],
	'gift'=>$row['gift']);
}

	$members = count($children);
?>

<?php

for($numMem = 0; $numMem < $members; $numMem++){
?>
	<h4>Member <?php echo ($numMem + 1) ?></h4>
	<table>
		<tr><td>Name:</td>
			<td><input type="text" name="nameTXT<?php echo $numMem?>" value="<?php echo $children[$numMem]['name']?>" /></td>
			<td>Sex:</td>
			<td>M<input type="radio" name="sexRAD<?php echo $numMem?>" value="M" <?php if($children[$numMem]['sex'] == "M"){ ?> checked <?php } ?> />&nbsp;&nbsp;
			F<input type="radio" name="sexRAD<?php echo $numMem?>" value="F" <?php if($children[$numMem]['sex'] == "F"){ ?> checked <?php } ?> /></td>
			<td>Age</td>
			<td><select name="ageSEL<?php echo $numMem?>">
					<option <?php if($children[$numMem]['age'] == null){?>selected<?php }?>>--</option>
<?php
for($i = 0; $i <= 110; $i++){?>
	<option value="<?php echo $i ?>" <?PHP if($i == $children[$numMem]['age']) echo "SELECTED";?>><?php echo $i ?></option><?php
}
?>
			</select></td>
		</tr>
		<tr>
			<td style="text-align: center;"><strong>Clothing</strong></td>
			<td colspan="2" style="text-align: center;"><strong>Size</strong></td>
			<td colspan="3" style="text-align: center;"><strong>Gifts or Toys wanted</strong></td>
			<td><input type='submit' name='delete' value='DELETE Member <?php echo ($numMem + 1)?>' /></td></tr>
		<tr>
			<td>Pants<br />
				Shirt/top<br />
				Underwear<br />
				Socks<br />
				Diapers</td>
			<td colspan="2"><input type="text" name="sizeTXT1<?php echo $numMem?>" value="<?php echo $children[$numMem]['pantSize']?>" /><br />
				<input type="text" name="sizeTXT2<?php echo $numMem?>" value="<?php echo $children[$numMem]['shirtSize']?>" /><br />
				<input type="text" name="sizeTXT3<?php echo $numMem?>" value="<?php echo $children[$numMem]['undSize']?>" /><br />
				<input type="text" name="sizeTXT4<?php echo $numMem?>" value="<?php echo $children[$numMem]['sockSize']?>" /><br />
				<input type="text" name="sizeTXT5<?php echo $numMem?>" value="<?php echo $children[$numMem]['diaperSize']?>" /></td>
				<input type="hidden" name="children" value="<?php echo $members ?>" />
				<input type="hidden" name="childID<?php echo $numMem?>" value="<?php echo $children[$numMem]['childID']?>" />
			<td colspan="3"><textarea name="giftsTXT<?php echo $numMem?>" rows="5" /><?php echo $children[$numMem]['gift']?></textarea></td></tr>
	</table>
	
<?php } ?>

	<input type='submit' name='action' value='Add Child' />

