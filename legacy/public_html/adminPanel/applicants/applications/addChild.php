
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

?>

	<h4>Add Member</h4>
	<table>
		<tr><td>Name:</td>
			<td><input type="text" name="nameTXT"/></td>
			<td>Sex:</td>
			<td>M<input type="radio" name="sexRAD" value="M"/>&nbsp;&nbsp;
			F<input type="radio" name="sexRAD" value="F"/></td>
			<td>Age</td>
			<td><select name="ageSEL">
					<option>--</option>
<?php
for($i = 0; $i <= 110; $i++){?>
	<option><?php echo $i ?></option><?php
}
?>
			</select></td>
		</tr>
		<tr>
			<td style="text-align: center;"><strong>Clothing</strong></td>
			<td colspan="2" style="text-align: center;"><strong>Size</strong></td>
			<td colspan="3" style="text-align: center;"><strong>Gifts or Toys wanted</strong></td>
		</tr>
		<tr>
			<td>Pants<br />
				Shirt/top<br />
				Underwear<br />
				Socks<br />
				Diapers</td>
			<td colspan="2"><input type="text" name="sizeTXT1"/><br />
				<input type="text" name="sizeTXT2" /><br />
				<input type="text" name="sizeTXT3"/><br />
				<input type="text" name="sizeTXT4"/><br />
				<input type="text" name="sizeTXT5"/></td>
				<input type="hidden" name="appID" value="<?php echo $appID;?>" />
			<td colspan="3"><textarea name="giftsTXT" rows="5" /></textarea></td></tr>
	</table>
	
<form action="#" method="post" name="newChild">
	<input class="btn-style" type='submit' name='action' value='Add' />
	</form>