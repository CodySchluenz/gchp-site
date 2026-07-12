<?php
if (!isset($_SESSION))
{
session_start(); 
}


?>
<div class="panelTable">
<form action="#" method="post" name="appForm3">
<table style=text-align="right">
		<tr><th colspan="4" style="text-align:center"></th></tr>
		<tr><td >Food share Amount:</td>
			<td colspan="2"><input type="text" size="10" name="foodAmt" value="<?php echo $_SESSION['app3'][0] ?>" /></td>
		</tr><!--
		<tr><td align="right">Badger Care Amount:</td>
			<td colspan="2"><input type="text" size="10" name="badgerAmt" value="<?php echo $badgerAmt ?>" /></td>
		</tr>
		<tr><td align="right">Medical Amount:</td>
			<td colspan="2"><input type="text" size="10" name="medicalAmt" value="<?php echo $medAmt ?>" /></td>
		</tr> -->
		<tr><td align="right">Social Security Amount:</td>
			<td colspan="2"><input type="text" size="10" name="socialAmt" value="<?php echo $_SESSION['app3'][1]; ?>" /></td>
		</tr>
		<tr><td align="right">SSI Amount:</td>
			<td colspan="2"><input type="text" size="10" name="ssiAmt" value="<?php echo $_SESSION['app3'][2]; ?>" /></td>
		</tr>
		<tr><td align="right">W2 Amount:</td>
			<td colspan="2"><input type="text" size="10" name="w2Amt" value="<?php echo $_SESSION['app3'][3]; ?>" /></td>
		</tr>
		<tr><td align="right">Child Support Amount:</td>
			<td colspan="2"><input type="text" size="10" name="childAmt" value="<?php echo $_SESSION['app3'][4]; ?>" /></td>
		</tr>
		<tr><td align="right">Other Income Amount:</td>
			<td colspan="2"><input type="text" size="10" name="otherAmt" value="<?php echo $_SESSION['app3'][5]; ?>" /></td>
		</tr>
	</table>
	</div>
	<div class="panelTable">
<table>
	<tr>
	<td>Please select the number of members in your household including yourself. 
<br>Please note, children listed must live at your residence full-time.</td>
<td>
<select name="numMemSEL">
<option value="1" <?php if($_SESSION['app3'][6] == 1) echo "selected" ?>>1</option>
<option value="2" <?php if($_SESSION['app3'][6] == 2) echo "selected" ?>>2</option>
<option value="3" <?php if($_SESSION['app3'][6] == 3) echo "selected" ?>>3</option>
<option value="4" <?php if($_SESSION['app3'][6] == 4) echo "selected" ?>>4</option>
<option value="5" <?php if($_SESSION['app3'][6] == 5) echo "selected" ?>>5</option>
<option value="6" <?php if($_SESSION['app3'][6] == 6) echo "selected" ?>>6</option>
<option value="7" <?php if($_SESSION['app3'][6] == 7) echo "selected" ?>>7</option>
<option value="8" <?php if($_SESSION['app3'][6] == 8) echo "selected" ?>>8</option>
<option value="9" <?php if($_SESSION['app3'][6] == 9) echo "selected" ?>>9</option>
<option value="10" <?php if($_SESSION['app3'][6] == 10) echo "selected" ?>>10</option>
<option value="11" <?php if($_SESSION['app3'][6] == 11) echo "selected" ?>>11</option>
<option value="12" <?php if($_SESSION['app3'][6] == 12) echo "selected" ?>>12</option>
<option value="13" <?php if($_SESSION['app3'][6] == 13) echo "selected" ?>>13</option>
<option value="14" <?php if($_SESSION['app3'][6] == 14) echo "selected" ?>>14</option>
<option value="15">15</option>
</select></td>
	</tr>




<br><br>
</table>
</div>
<div class="form_settings"><br><br>
<input class="inputBtn" type="submit" value="Back" name="back"/>&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Cancel" name="cancel" onclick="show_confirm()" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Next" name="appPt3" />
</div>
</form>