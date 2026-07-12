<?PHP
if (!isset($_SESSION))
{
session_start(); 
}
	$members = $_SESSION['app3'][6];
?>

<form action="#" method="post" name="appForm4">
<?php
for($numMem = 1; $numMem <= $members; $numMem++){
?>
	<h4>Member <?php echo $numMem ?></h4>
	<div class="panelTable"><table>
		<tr><td>Type first and last Name:</td>
			<td><input type="text" name="nameTXT<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][0]?>" /></td>
			<td>Sex:</td>
			<td>M<input type="radio" name="sexRAD<?php echo $numMem?>" value="M" <?php if($_SESSION['app4'][$numMem][1] == "M"){ ?> checked <?php } ?> />&nbsp;&nbsp;
			F<input type="radio" name="sexRAD<?php echo $numMem?>" value="F" <?php if($_SESSION['app4'][$numMem][1] == "F"){ ?> checked <?php } ?> /></td>
			<td>Age</td>
			<td><select name="ageSEL<?php echo $numMem?>">
					<option <?php if($_SESSION['app4'][$numMem][2] == null){?>selected<?php }?>>--</option>
<?php
for($i = 0; $i <= 110; $i++){?>
	<option value="<?php echo $i ?>" <?PHP if($i == $_SESSION['app4'][$numMem][2]) echo "SELECTED";?>><?php echo $i ?></option><?php
}
?>
			</select></td>
		</tr>
		<tr>
			<td style="text-align: center;"><strong>Clothing</strong></td>
			<td colspan="2" style="text-align: center;"><strong>Size</strong></td>
			<td colspan="3" style="text-align: center;"><strong>Gifts or Toys wanted</strong></td></tr>
		<tr>
			<td>Pants<br />
				Shirt/top<br />
				Underwear<br />
				Socks<br />
				Diapers</td>
			<td colspan="2"><input type="text" name="sizeTXT1<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][3]?>" /><br />
				<input type="text" name="sizeTXT2<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][4]?>" /><br />
				<input type="text" name="sizeTXT3<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][5]?>" /><br />
				<input type="text" name="sizeTXT4<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][6]?>" /><br />
				<input type="text" name="sizeTXT5<?php echo $numMem?>" value="<?php echo $_SESSION['app4'][$numMem][7]?>" /></td>
				<input type="hidden" name="children" value="<?php echo $members ?>" />
			<td colspan="3"><textarea name="giftsTXT<?php echo $numMem?>" rows="5" /><?php echo $_SESSION['app4'][$numMem][8]?></textarea></td></tr>
	</table></div>
	
<?php } ?><br><br>
<div class="form_settings">
<input class="inputBtn" type="submit" value="Back" name="back"/>&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Cancel" name="cancel" onclick="show_confirm()" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Next" name="appPt4" />
</div>
</form>